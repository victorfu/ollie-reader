import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GACHA_MISS_RATE_STORAGE_KEY,
  SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY,
} from "../../../services/gachaPreferences";
import type {
  CommittedGachaAttempt,
  GachaCloudPendingReveal,
  GachaMachineState,
  GachaSaveV1,
} from "./gachaTypes";

const authState = vi.hoisted(() => ({
  user: { uid: "player-1" } as { uid: string } | null,
  loading: false,
  authError: null as string | null,
  signInWithGoogle: vi.fn(),
}));
const playSoundMock = vi.hoisted(() => vi.fn());

const storageMocks = vi.hoisted(() => ({
  compareGachaSaveVersions: vi.fn((left: GachaSaveV1, right: GachaSaveV1) => {
    if (left.resetVersion !== right.resetVersion) {
      return left.resetVersion > right.resetVersion ? 1 : -1;
    }
    return Math.sign(left.totalDraws - right.totalDraws);
  }),
  getGachaCacheKey: vi.fn((uid: string) => `ollie-gacha-machine-cache-v1:${uid}`),
  acknowledgeGachaPendingReveal: vi.fn(),
  isGachaResetConflictError: vi.fn(() => false),
  isGachaPendingRevealConflictError: vi.fn(() => false),
  parseGachaCacheValue: vi.fn((raw: string | null) =>
    raw ? (JSON.parse(raw) as GachaSaveV1) : null,
  ),
  parseGachaMachineCacheState: vi.fn((raw: string | null): GachaMachineState | null => {
    const save = raw ? (JSON.parse(raw) as GachaSaveV1) : null;
    return save ? { save, pendingReveal: null } : null;
  }),
  isGachaInsufficientCoinsError: vi.fn(() => false),
  readGachaCache: vi.fn(),
  readGachaMachineCacheState: vi.fn(),
  loadGachaCloud: vi.fn(),
  loadGachaMachineState: vi.fn(),
  loadPlayerCoins: vi.fn(),
  recordGachaAttempt: vi.fn(),
  resetGachaCollection: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const { createElement, forwardRef, Fragment } = await import("react");
  const motionProps = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileTap",
    "layout",
  ]);
  const motion = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_target, tag) =>
      forwardRef(function MotionStub(
        props: Record<string, unknown>,
        ref: unknown,
      ) {
        const domProps: Record<string, unknown> = { ref };
        for (const [key, value] of Object.entries(props)) {
          if (!motionProps.has(key) && key !== "children") domProps[key] = value;
        }
        return createElement(String(tag), domProps, props.children as ReactNode);
      }),
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) =>
      createElement(Fragment, null, children),
    useReducedMotion: () => true,
  };
});

vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("../../../services/gameService", () => ({ playSound: playSoundMock }));
vi.mock("../../../utils/logger", () => ({
  logger: { error: vi.fn() },
}));
vi.mock("./gachaStorage", () => storageMocks);
vi.mock("./GachaRevealDialog", () => ({
  GachaRevealDialog: ({
    isOpen,
    result,
    onClose,
  }: {
    isOpen: boolean;
    result: CommittedGachaAttempt["result"] | null;
    onClose: () => void;
  }) =>
    isOpen ? (
      <button
        type="button"
        data-testid="reveal-dialog"
        data-is-new={
          result?.kind === "character" ? String(result.isNew) : undefined
        }
        data-owned-count={
          result?.kind === "character" ? result.ownedCount : undefined
        }
        onClick={onClose}
      >
        {result?.kind}
      </button>
    ) : null,
}));

import GachaMachine from "./GachaMachine";
import {
  GACHA_REVEAL_GUARD_HEARTBEAT_MS,
  GACHA_REVEAL_GUARD_PREFIX,
  beginGachaRevealGuard,
  endGachaRevealGuard,
  getGachaRevealGuardKey,
  listActiveGachaRevealGuards,
} from "./gachaRevealGuard";
import {
  beginGachaPendingReveal,
  commitGachaPendingReveal,
  GACHA_PENDING_REVEAL_COMMITTED_EVENT,
} from "./gachaPendingReveal";

let container: HTMLDivElement;
let root: Root;

const EMPTY_SAVE: GachaSaveV1 = {
  schemaVersion: 1,
  resetVersion: 0,
  totalDraws: 0,
  ownedCounts: {},
};

function cloudPendingReveal(
  attemptId: string,
  committedAttempt: CommittedGachaAttempt,
  baselineSave: GachaSaveV1 = EMPTY_SAVE,
): GachaCloudPendingReveal {
  return {
    schemaVersion: 1,
    attemptId,
    resetVersion: committedAttempt.save.resetVersion,
    baselineSave,
    committedAttempt,
    createdAt: 1_723_456_789_000,
  };
}

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

async function renderAt(
  entry: string,
  onExit: () => void = vi.fn(),
): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <GachaMachine onExit={onExit} />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function buttonWithText(text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`button not found: ${text}`);
  }
  return button;
}

function dispatchShortcut(
  code: "Space" | "Enter",
  init: KeyboardEventInit = {},
  target: Window | Element = window,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: code === "Space" ? " " : "Enter",
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

async function flushRevealAcknowledgement(): Promise<void> {
  await act(async () => {
    if (vi.isFakeTimers()) {
      await vi.advanceTimersByTimeAsync(0);
    } else {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
    await Promise.resolve();
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  setOnline(true);
  localStorage.clear();
  sessionStorage.clear();
  authState.user = { uid: "player-1" };
  authState.loading = false;
  authState.authError = null;
  authState.signInWithGoogle.mockReset();
  playSoundMock.mockReset();
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  storageMocks.readGachaCache.mockReset().mockReturnValue(null);
  storageMocks.readGachaMachineCacheState.mockReset().mockImplementation(
    (uid: string) => {
      const save = storageMocks.readGachaCache(uid);
      return save ? { save, pendingReveal: null } : null;
    },
  );
  storageMocks.loadGachaCloud.mockReset().mockResolvedValue(EMPTY_SAVE);
  storageMocks.loadGachaMachineState.mockReset().mockImplementation(
    async (uid: string) => ({
      save: await storageMocks.loadGachaCloud(uid),
      pendingReveal: null,
    }),
  );
  storageMocks.acknowledgeGachaPendingReveal.mockReset().mockResolvedValue(true);
  storageMocks.loadPlayerCoins.mockReset().mockResolvedValue(500);
  storageMocks.recordGachaAttempt.mockReset();
  storageMocks.resetGachaCollection.mockReset();
  storageMocks.isGachaResetConflictError.mockReset().mockReturnValue(false);
  storageMocks.isGachaPendingRevealConflictError
    .mockReset()
    .mockReturnValue(false);
  storageMocks.isGachaInsufficientCoinsError.mockReset().mockReturnValue(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("GachaMachine page states", () => {
  it("shows a retryable cloud error instead of a loading message", async () => {
    storageMocks.loadGachaCloud.mockRejectedValue(new Error("offline"));

    await renderAt("/games/gacha");

    expect(container.textContent).toContain(
      "無法同步雲端圖鑑，請重新同步後再試。",
    );
    expect(container.textContent).not.toContain("正在確認雲端圖鑑，請稍候。");
    expect(container.textContent).toContain("雲端同步失敗");
    expect(buttonWithText("重新同步")).toBeInstanceOf(HTMLButtonElement);
  });

  it("uses the configured empty-capsule rate without showing the control in the game", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    storageMocks.recordGachaAttempt.mockResolvedValue({
      coinsAfter: 450,
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      result: { kind: "miss", totalDraws: 1 },
    });
    await renderAt("/games/gacha");

    expect(
      container.querySelector('input[aria-label="空膠囊機率"]'),
    ).toBeNull();
    expect(container.textContent).toContain("50% 命中角色、50% 空膠囊");

    act(() => {
      localStorage.setItem(GACHA_MISS_RATE_STORAGE_KEY, "75");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: GACHA_MISS_RATE_STORAGE_KEY,
          newValue: "75",
        }),
      );
    });

    expect(container.textContent).toContain("25% 命中角色、75% 空膠囊");

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });

    expect(storageMocks.recordGachaAttempt).toHaveBeenCalledWith(
      "player-1",
      { kind: "miss" },
      0,
      expect.any(String),
    );
    randomSpy.mockRestore();
  });

  it("opens the collection from a deep link", async () => {
    const collectionSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: { kuromi: 1 },
    };
    storageMocks.readGachaCache.mockReturnValue(collectionSave);
    storageMocks.loadGachaCloud.mockResolvedValue(collectionSave);

    await renderAt("/games/gacha?view=collection");

    expect(container.textContent).toContain("我的角色圖鑑");
    expect(container.textContent).toContain("酷洛米");
    expect(buttonWithText("圖鑑").getAttribute("aria-current")).toBe("page");
  });

  it("applies the local full-collection preview without faking progress", async () => {
    localStorage.setItem(SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY, "true");

    await renderAt("/games/gacha?view=collection");

    expect(container.textContent).toContain("完整圖鑑預覽已開啟");
    expect(container.textContent).toContain("0 / 57");
    expect(container.querySelector('img[alt="Hello Kitty"]')).toBeTruthy();
    expect(storageMocks.recordGachaAttempt).not.toHaveBeenCalled();

    localStorage.setItem(SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY, "false");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY,
          newValue: "false",
        }),
      );
    });

    expect(container.textContent).not.toContain("完整圖鑑預覽已開啟");
    expect(container.querySelector('img[alt="Hello Kitty"]')).toBeNull();
    expect(container.textContent).toContain("0 / 57");
  });

  it("renders popular cartoon characters as separate collection items", async () => {
    const collectionSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 6,
      ownedCounts: {
        "crayon-shinchan": 1,
        "waniyama-san": 1,
        buriburizaemon: 1,
        doraemon: 1,
        dorami: 1,
        "nobita-nobi": 1,
      },
    };
    storageMocks.readGachaCache.mockReturnValue(collectionSave);
    storageMocks.loadGachaCloud.mockResolvedValue(collectionSave);

    await renderAt("/games/gacha?view=collection");

    for (const name of [
      "蠟筆小新",
      "鱷魚阿山",
      "肥嘟嘟左衛門",
      "哆啦A夢",
      "哆啦美",
      "大雄",
    ]) {
      expect(container.querySelector(`img[alt="${name}"]`)).toBeTruthy();
    }
    expect(container.textContent).toContain("6 / 57");
  });

  it("shows auth loading and signed-out states without loading Firestore", async () => {
    authState.user = null;
    authState.loading = true;
    await renderAt("/games/gacha");
    expect(container.textContent).toContain("正在準備扭蛋機");
    expect(storageMocks.loadGachaCloud).not.toHaveBeenCalled();

    authState.loading = false;
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/games/gacha"]}>
          <GachaMachine onExit={vi.fn()} />
        </MemoryRouter>,
      );
    });
    expect(container.textContent).toContain("登入後開始收藏");
  });

  it("uses the uid cache offline and keeps drawing disabled", async () => {
    setOnline(false);
    storageMocks.readGachaCache.mockReturnValue({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 2,
      ownedCounts: { gudetama: 2 },
    });

    await renderAt("/games/gacha?view=collection");

    expect(container.textContent).toContain("離線快取 · 僅供查看");
    expect(container.textContent).toContain("蛋黃哥");
    expect(storageMocks.loadGachaCloud).not.toHaveBeenCalled();
  });

  it("does not present an empty collection as cached progress offline", async () => {
    setOnline(false);

    await renderAt("/games/gacha?view=collection");

    expect(container.textContent).toContain("這台裝置還沒有離線圖鑑");
    expect(container.textContent).not.toContain("收集進度");
    expect(storageMocks.loadGachaCloud).not.toHaveBeenCalled();
  });

  it("labels an offline full preview as uncached", async () => {
    setOnline(false);
    localStorage.setItem(SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY, "true");

    await renderAt("/games/gacha?view=collection");

    expect(container.textContent).toContain("完整圖鑑預覽已開啟");
    expect(container.textContent).toContain("這台裝置沒有離線快取");
    expect(container.textContent).not.toContain("離線快取 · 僅供查看");
    expect(storageMocks.loadGachaCloud).not.toHaveBeenCalled();
  });

  it("never paints the previous user's collection after the uid changes", async () => {
    const userASave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 2,
      ownedCounts: { kuromi: 2 },
    };
    storageMocks.readGachaCache.mockImplementation((uid: string) =>
      uid === "player-a" ? userASave : null,
    );
    storageMocks.loadGachaCloud.mockImplementation((uid: string) =>
      uid === "player-a"
        ? Promise.resolve(userASave)
        : new Promise<GachaSaveV1>(() => undefined),
    );
    authState.user = { uid: "player-a" };
    await renderAt("/games/gacha?view=collection");
    expect(container.textContent).toContain("酷洛米");

    authState.user = { uid: "player-b" };
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/games/gacha?view=collection"]}>
          <GachaMachine onExit={vi.fn()} />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).not.toContain("酷洛米");
    expect(buttonWithText("清空圖鑑").disabled).toBe(true);
  });
});

describe("GachaMachine draw guard", () => {
  it("recovers an atomically committed result when the original callback was lost", async () => {
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: {
        ...EMPTY_SAVE,
        totalDraws: 1,
        ownedCounts: { kuromi: 1 },
      },
      result: {
        kind: "character",
        characterId: "kuromi",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    };
    const pendingReveal = cloudPendingReveal(
      "server-committed-attempt",
      committed,
    );
    storageMocks.loadGachaMachineState.mockResolvedValue({
      save: committed.save,
      pendingReveal,
    });

    await renderAt("/games/gacha");

    expect(storageMocks.recordGachaAttempt).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
    act(() => buttonWithText("圖鑑").click());
    expect(container.textContent).not.toContain("酷洛米");
    act(() => buttonWithText("扭蛋機").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("character");
    await flushRevealAcknowledgement();
  });

  it("recovers an atomically committed miss without inventing a character", async () => {
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    };
    storageMocks.loadGachaMachineState.mockResolvedValue({
      save: committed.save,
      pendingReveal: cloudPendingReveal("server-miss-attempt", committed),
    });

    await renderAt("/games/gacha");
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("miss");
    await flushRevealAcknowledgement();
  });

  it("replays the closed capsule after reveal acknowledgement crashes", async () => {
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    };
    const pendingReveal = cloudPendingReveal("ack-crash-attempt", committed);
    storageMocks.loadGachaMachineState.mockResolvedValue({
      save: committed.save,
      pendingReveal,
    });
    storageMocks.acknowledgeGachaPendingReveal.mockRejectedValue(
      new Error("ack offline"),
    );
    await renderAt("/games/gacha");
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await flushRevealAcknowledgement();
    expect(container.textContent).toContain("雲端確認暫時失敗");

    act(() => root.unmount());
    root = createRoot(container);
    storageMocks.acknowledgeGachaPendingReveal.mockResolvedValue(true);
    await renderAt("/games/gacha");

    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("miss");
  });

  it("replaces a crashed submitting guard with the authoritative server capsule", async () => {
    const staleGuard = beginGachaRevealGuard(
      "player-1",
      EMPTY_SAVE,
      localStorage,
      Date.now(),
      "stale-submitting-attempt",
    );
    if (!staleGuard) throw new Error("stale guard was not created");
    expect(
      beginGachaPendingReveal(
        "player-1",
        staleGuard,
        { kind: "miss" },
        sessionStorage,
      ),
    ).not.toBeNull();

    const baselineSave: GachaSaveV1 = {
      ...EMPTY_SAVE,
      totalDraws: 2,
      ownedCounts: { "hello-kitty": 1, kuromi: 1 },
    };
    const committed: CommittedGachaAttempt = {
      coinsAfter: 350,
      save: {
        ...baselineSave,
        totalDraws: 3,
        ownedCounts: { "hello-kitty": 1, kuromi: 2 },
      },
      result: {
        kind: "character",
        characterId: "kuromi",
        isNew: false,
        ownedCount: 2,
        totalDraws: 3,
      },
    };
    const authoritativeState = {
      save: committed.save,
      pendingReveal: cloudPendingReveal(
        "authoritative-attempt",
        committed,
        baselineSave,
      ),
    };
    storageMocks.readGachaMachineCacheState.mockReturnValue(
      authoritativeState,
    );
    storageMocks.loadGachaMachineState.mockReturnValue(
      new Promise<GachaMachineState>(() => undefined),
    );

    await renderAt("/games/gacha");

    expect(
      listActiveGachaRevealGuards("player-1", localStorage).map(
        (guard) => guard.token,
      ),
    ).toEqual(["authoritative-attempt"]);
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    const dialog = container.querySelector<HTMLElement>(
      '[data-testid="reveal-dialog"]',
    );
    expect(dialog?.dataset.isNew).toBe("false");
    expect(dialog?.dataset.ownedCount).toBe("2");
    await flushRevealAcknowledgement();
    act(() => dialog?.click());
    act(() => buttonWithText("圖鑑").click());

    expect(container.textContent).toContain("Hello Kitty");
    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).toContain("2 / 57");
    expect(listActiveGachaRevealGuards("player-1", localStorage)).toHaveLength(0);
  });

  it("lets an authoritative revealed save supersede a crashed submitting guard", async () => {
    const staleGuard = beginGachaRevealGuard(
      "player-1",
      EMPTY_SAVE,
      localStorage,
      Date.now(),
      "stale-no-pending-attempt",
    );
    if (!staleGuard) throw new Error("stale guard was not created");
    expect(
      beginGachaPendingReveal(
        "player-1",
        staleGuard,
        { kind: "miss" },
        sessionStorage,
      ),
    ).not.toBeNull();
    const revealedSave: GachaSaveV1 = {
      ...EMPTY_SAVE,
      totalDraws: 2,
      ownedCounts: { "hello-kitty": 1, kuromi: 1 },
    };
    storageMocks.loadGachaMachineState.mockResolvedValue({
      save: revealedSave,
      pendingReveal: null,
    });

    await renderAt("/games/gacha?view=collection");

    expect(container.textContent).toContain("Hello Kitty");
    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).toContain("2 / 57");
    expect(listActiveGachaRevealGuards("player-1", localStorage)).toHaveLength(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("applies a newer revealed save when acknowledging an obsolete capsule", async () => {
    const obsoleteAttempt: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: {
        ...EMPTY_SAVE,
        totalDraws: 1,
        ownedCounts: { "hello-kitty": 1 },
      },
      result: {
        kind: "character",
        characterId: "hello-kitty",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    };
    const newerSave: GachaSaveV1 = {
      ...EMPTY_SAVE,
      totalDraws: 3,
      ownedCounts: {
        "hello-kitty": 1,
        "my-melody": 1,
        kuromi: 1,
      },
    };
    storageMocks.loadGachaMachineState
      .mockResolvedValueOnce({
        save: obsoleteAttempt.save,
        pendingReveal: cloudPendingReveal(
          "obsolete-attempt",
          obsoleteAttempt,
        ),
      })
      .mockResolvedValueOnce({ save: newerSave, pendingReveal: null });
    storageMocks.acknowledgeGachaPendingReveal.mockResolvedValue(false);

    await renderAt("/games/gacha");
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await flushRevealAcknowledgement();
    act(() => {
      container.querySelector<HTMLElement>('[data-testid="reveal-dialog"]')
        ?.click();
      buttonWithText("圖鑑").click();
    });

    expect(container.textContent).toContain("Hello Kitty");
    expect(container.textContent).toContain("My Melody");
    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).toContain("3 / 57");
  });

  it("restores a valid callback-loss event only when its cache receipt still matches", async () => {
    await renderAt("/games/gacha");
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    };
    const pendingReveal = cloudPendingReveal(
      "callback-loss-attempt",
      committed,
    );
    storageMocks.readGachaMachineCacheState.mockReturnValue({
      save: committed.save,
      pendingReveal,
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(GACHA_PENDING_REVEAL_COMMITTED_EVENT, {
          detail: { uid: "player-1", pendingReveal },
        }),
      );
    });

    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
  });

  it("keeps an opened cached capsule visible when the same cloud receipt arrives", async () => {
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: {
        ...EMPTY_SAVE,
        totalDraws: 1,
        ownedCounts: { "hello-kitty": 1 },
      },
      result: {
        kind: "character",
        characterId: "hello-kitty",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    };
    const pendingReveal = cloudPendingReveal(
      "cached-open-attempt",
      committed,
    );
    const machineState: GachaMachineState = {
      save: committed.save,
      pendingReveal,
    };
    let resolveCloud: ((state: GachaMachineState) => void) | undefined;
    storageMocks.readGachaMachineCacheState.mockReturnValue(machineState);
    storageMocks.loadGachaMachineState.mockReturnValue(
      new Promise<GachaMachineState>((resolve) => {
        resolveCloud = resolve;
      }),
    );
    await renderAt("/games/gacha");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("character");

    await act(async () => {
      resolveCloud?.(machineState);
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("character");
    expect(
      container.querySelector<HTMLElement>('[data-testid="reveal-dialog"]')
        ?.dataset.ownedCount,
    ).toBe("1");
    await flushRevealAcknowledgement();
    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("character");
    act(() => {
      container.querySelector<HTMLElement>('[data-testid="reveal-dialog"]')
        ?.click();
    });
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
  });

  it("ignores an ABA late callback after the server cache has advanced", async () => {
    const newerSave: GachaSaveV1 = {
      ...EMPTY_SAVE,
      totalDraws: 2,
      ownedCounts: { "hello-kitty": 1, kuromi: 1 },
    };
    storageMocks.readGachaMachineCacheState.mockReturnValue({
      save: newerSave,
      pendingReveal: null,
    });
    storageMocks.loadGachaMachineState.mockResolvedValue({
      save: newerSave,
      pendingReveal: null,
    });
    await renderAt("/games/gacha?view=collection");

    const staleAttempt: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: {
        ...EMPTY_SAVE,
        totalDraws: 1,
        ownedCounts: { "hello-kitty": 1 },
      },
      result: {
        kind: "character",
        characterId: "hello-kitty",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    };
    const stalePendingReveal = cloudPendingReveal(
      "old-a-attempt",
      staleAttempt,
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent(GACHA_PENDING_REVEAL_COMMITTED_EVENT, {
          detail: {
            uid: "player-1",
            pendingReveal: stalePendingReveal,
          },
        }),
      );
    });

    expect(container.textContent).toContain("Hello Kitty");
    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).toContain("2 / 57");
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();
  });

  it("never restores another uid's server pending reveal after account switch", async () => {
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    };
    const pendingReveal = cloudPendingReveal("player-a-attempt", committed);
    authState.user = { uid: "player-a" };
    storageMocks.loadGachaMachineState.mockImplementation(
      async (uid: string) =>
        uid === "player-a"
          ? { save: committed.save, pendingReveal }
          : { save: EMPTY_SAVE, pendingReveal: null },
    );
    await renderAt("/games/gacha");
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();

    authState.user = { uid: "player-b" };
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/games/gacha"]}>
          <GachaMachine onExit={vi.fn()} />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });

    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
    expect(container.textContent).not.toContain("已找回尚未開啟的膠囊");
  });

  it("submits B's acknowledgement while A's acknowledgement is still pending", async () => {
    const committedA: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    };
    const committedB: CommittedGachaAttempt = {
      coinsAfter: 400,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    };
    storageMocks.loadGachaMachineState.mockImplementation(
      async (uid: string) => {
        const committed = uid === "player-a" ? committedA : committedB;
        return {
          save: committed.save,
          pendingReveal: cloudPendingReveal(`${uid}-attempt`, committed),
        };
      },
    );
    let resolveA: ((value: boolean) => void) | undefined;
    let resolveB: ((value: boolean) => void) | undefined;
    storageMocks.acknowledgeGachaPendingReveal.mockImplementation(
      (uid: string) =>
        new Promise<boolean>((resolve) => {
          if (uid === "player-a") resolveA = resolve;
          else resolveB = resolve;
        }),
    );
    authState.user = { uid: "player-a" };
    await renderAt("/games/gacha");
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await act(async () => {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    });
    expect(storageMocks.acknowledgeGachaPendingReveal).toHaveBeenCalledWith(
      "player-a",
      "player-a-attempt",
    );

    authState.user = { uid: "player-b" };
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/games/gacha"]}>
          <GachaMachine onExit={vi.fn()} />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await act(async () => {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    });
    expect(storageMocks.acknowledgeGachaPendingReveal).toHaveBeenCalledWith(
      "player-b",
      "player-b-attempt",
    );

    await act(async () => {
      resolveB?.(true);
      await Promise.resolve();
    });
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();
    await act(async () => {
      resolveA?.(true);
      await Promise.resolve();
    });
    expect(authState.user?.uid).toBe("player-b");
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();
  });

  it("restores a paid character capsule after unmount without revealing it", async () => {
    localStorage.setItem(GACHA_MISS_RATE_STORAGE_KEY, "0");
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: {
        ...EMPTY_SAVE,
        totalDraws: 1,
        ownedCounts: { "hello-kitty": 1 },
      },
      result: {
        kind: "character",
        characterId: "hello-kitty",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    };
    storageMocks.recordGachaAttempt.mockResolvedValue(committed);

    await renderAt("/games/gacha");
    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();

    storageMocks.readGachaCache.mockReturnValue(committed.save);
    storageMocks.loadGachaCloud.mockResolvedValue(committed.save);
    act(() => root.unmount());
    root = createRoot(container);
    await renderAt("/games/gacha");

    expect(container.textContent).toContain("已找回尚未開啟的膠囊");
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await flushRevealAcknowledgement();
    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("character");
    expect(listActiveGachaRevealGuards("player-1", localStorage)).toHaveLength(0);
    expect(sessionStorage.length).toBe(0);
    randomSpy.mockRestore();
  });

  it("restores a paid empty capsule with its miss outcome intact", async () => {
    localStorage.setItem(GACHA_MISS_RATE_STORAGE_KEY, "100");
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    };
    storageMocks.recordGachaAttempt.mockResolvedValue(committed);

    await renderAt("/games/gacha");
    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });
    storageMocks.readGachaCache.mockReturnValue(committed.save);
    storageMocks.loadGachaCloud.mockResolvedValue(committed.save);
    act(() => root.unmount());
    root = createRoot(container);
    await renderAt("/games/gacha");

    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await flushRevealAcknowledgement();
    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("miss");
  });

  it("blocks the page Back action while a paid transaction is settling", async () => {
    const onExit = vi.fn();
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>(() => undefined),
    );
    await renderAt("/games/gacha", onExit);

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      container
        .querySelector<HTMLButtonElement>('button[aria-label="返回小遊戲"]')
        ?.click();
    });

    expect(onExit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("請等膠囊掉出後再返回");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("restores the server capsule after an in-flight draw hits a pending conflict", async () => {
    const serverAttempt: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    };
    const pendingReveal = cloudPendingReveal(
      "other-device-attempt",
      serverAttempt,
    );
    storageMocks.loadGachaMachineState
      .mockResolvedValueOnce({ save: EMPTY_SAVE, pendingReveal: null })
      .mockResolvedValueOnce({ save: serverAttempt.save, pendingReveal });
    storageMocks.recordGachaAttempt.mockRejectedValue({
      code: "GACHA_PENDING_REVEAL_CONFLICT",
    });
    storageMocks.isGachaPendingRevealConflictError.mockReturnValue(true);

    await renderAt("/games/gacha");
    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("已有一顆付費膠囊等待開啟");
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    expect(
      container.querySelector('[data-testid="reveal-dialog"]')?.textContent,
    ).toBe("miss");
  });

  it("discards a recovered capsule after a newer reset generation", async () => {
    const guard = beginGachaRevealGuard(
      "player-1",
      EMPTY_SAVE,
      localStorage,
      Date.now(),
      "pre-reset-draw",
    );
    if (!guard) throw new Error("guard was not created");
    const pending = beginGachaPendingReveal(
      "player-1",
      guard,
      { kind: "miss" },
      sessionStorage,
    );
    if (!pending) throw new Error("pending reveal was not created");
    expect(
      commitGachaPendingReveal(
        pending,
        {
          coinsAfter: 450,
          save: { ...EMPTY_SAVE, totalDraws: 1 },
          result: { kind: "miss", totalDraws: 1 },
        },
        sessionStorage,
      ),
    ).not.toBeNull();
    const resetSave: GachaSaveV1 = {
      ...EMPTY_SAVE,
      resetVersion: 1,
    };
    storageMocks.readGachaCache.mockReturnValue(resetSave);
    storageMocks.loadGachaCloud.mockResolvedValue(resetSave);

    await renderAt("/games/gacha");

    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(listActiveGachaRevealGuards("player-1", localStorage)).toHaveLength(0);
  });

  it("does not submit a draw when its durable reveal guard cannot be saved", async () => {
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function setItem(
        this: Storage,
        key: string,
        value: string,
      ) {
        if (key.startsWith(GACHA_REVEAL_GUARD_PREFIX)) {
          throw new DOMException("blocked", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      });
    storageMocks.recordGachaAttempt.mockResolvedValue({
      coinsAfter: 450,
      save: { ...EMPTY_SAVE, totalDraws: 1 },
      result: { kind: "miss", totalDraws: 1 },
    });

    try {
      await renderAt("/games/gacha");
      act(() => buttonWithText("投入 50 代幣").click());
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
          ?.click();
        await Promise.resolve();
      });

      expect(storageMocks.recordGachaAttempt).not.toHaveBeenCalled();
      expect(container.textContent).toContain(
        "無法建立安全的跨分頁開獎保護",
      );
      expect(container.textContent).toContain("這次沒有送出也沒有扣款");
      expect(buttonWithText("投入 50 代幣").disabled).toBe(false);
      expect(() => {
        localStorage.setItem(
          "ollie-gacha-machine-cache-v1:player-1",
          JSON.stringify(EMPTY_SAVE),
        );
      }).not.toThrow();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("renews its guard during both the transaction and unopened capsule", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T10:00:00.000Z"));
    let finishDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });
    const initialGuard = listActiveGachaRevealGuards(
      "player-1",
      localStorage,
      Date.now(),
    )[0];
    if (!initialGuard) throw new Error("guard was not created");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GACHA_REVEAL_GUARD_HEARTBEAT_MS);
    });
    const inFlightGuard = listActiveGachaRevealGuards(
      "player-1",
      localStorage,
      Date.now(),
    )[0];
    expect(inFlightGuard?.expiresAt).toBeGreaterThan(initialGuard.expiresAt);

    await act(async () => {
      finishDraw?.({
        coinsAfter: 450,
        save: {
          ...EMPTY_SAVE,
          totalDraws: 1,
          ownedCounts: { "hello-kitty": 1 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
    });
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GACHA_REVEAL_GUARD_HEARTBEAT_MS);
    });
    const pendingGuard = listActiveGachaRevealGuards(
      "player-1",
      localStorage,
      Date.now(),
    )[0];
    expect(pendingGuard?.expiresAt).toBeGreaterThan(inFlightGuard?.expiresAt ?? 0);
    expect(pendingGuard?.token).toBe(initialGuard.token);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        GACHA_REVEAL_GUARD_HEARTBEAT_MS + 1,
      );
    });
    expect(Date.now()).toBeGreaterThan(initialGuard.expiresAt);
    expect(
      listActiveGachaRevealGuards("player-1", localStorage, Date.now()),
    ).toHaveLength(1);

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await flushRevealAcknowledgement();
    expect(
      listActiveGachaRevealGuards("player-1", localStorage, Date.now()),
    ).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GACHA_REVEAL_GUARD_HEARTBEAT_MS * 2);
    });
    expect(
      listActiveGachaRevealGuards("player-1", localStorage, Date.now()),
    ).toHaveLength(0);
  });

  it("opens a new tab on the safe baseline until its restored capsule is opened", async () => {
    const baselineSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 4,
      ownedCounts: { kuromi: 2 },
    };
    const pendingCache: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 5,
      ownedCounts: { kuromi: 2, "hello-kitty": 1 },
    };
    const guard = beginGachaRevealGuard(
      "player-1",
      baselineSave,
      localStorage,
      Date.now(),
      "already-pending-draw",
    );
    if (!guard) throw new Error("guard was not created");
    const committed: CommittedGachaAttempt = {
      coinsAfter: 250,
      save: pendingCache,
      result: {
        kind: "character",
        characterId: "hello-kitty",
        isNew: true,
        ownedCount: 1,
        totalDraws: 5,
      },
    };
    const pendingReveal = cloudPendingReveal(
      guard.token,
      committed,
      baselineSave,
    );
    storageMocks.readGachaMachineCacheState.mockReturnValue({
      save: pendingCache,
      pendingReveal,
    });
    storageMocks.loadGachaMachineState.mockResolvedValue({
      save: pendingCache,
      pendingReveal,
    });

    await renderAt("/games/gacha?view=collection");

    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).not.toContain("Hello Kitty");
    expect(container.textContent).toContain("1 / 57");

    act(() => buttonWithText("回到扭蛋機").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await flushRevealAcknowledgement();
    act(() => {
      container.querySelector<HTMLElement>('[data-testid="reveal-dialog"]')
        ?.click();
      buttonWithText("圖鑑").click();
    });

    expect(container.textContent).toContain("Hello Kitty");
    expect(container.textContent).toContain("2 / 57");
  });

  it("keeps another tab's committed draw hidden until that tab reveals it", async () => {
    await renderAt("/games/gacha?view=collection");

    const guard = beginGachaRevealGuard(
      "player-1",
      EMPTY_SAVE,
      localStorage,
      Date.now(),
      "other-tab-draw",
    );
    if (!guard) throw new Error("guard was not created");
    const committed: CommittedGachaAttempt = {
      coinsAfter: 450,
      save: {
        ...EMPTY_SAVE,
        totalDraws: 1,
        ownedCounts: { kuromi: 1 },
      },
      result: {
        kind: "character",
        characterId: "kuromi",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    };
    const pendingReveal = cloudPendingReveal(guard.token, committed);
    storageMocks.parseGachaMachineCacheState.mockReturnValueOnce({
      save: committed.save,
      pendingReveal,
    });

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 0,
            totalDraws: 1,
            ownedCounts: { kuromi: 1 },
          }),
        }),
      );
    });

    expect(container.textContent).not.toContain("酷洛米");
    expect(container.textContent).toContain("0 / 57");

    act(() => buttonWithText("扭蛋機").click());
    expect(buttonWithText("投入 50 代幣").disabled).toBe(true);

    storageMocks.parseGachaMachineCacheState.mockReturnValueOnce({
      save: committed.save,
      pendingReveal: null,
    });
    act(() => {
      endGachaRevealGuard(guard, localStorage);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify(committed.save),
        }),
      );
    });

    expect(buttonWithText("投入 50 代幣").disabled).toBe(false);
    act(() => buttonWithText("圖鑑").click());
    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).toContain("1 / 57");
  });

  it("publishes a cross-tab guard before saving and clears it on reveal", async () => {
    let finishDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });
    expect(
      listActiveGachaRevealGuards("player-1", localStorage),
    ).toHaveLength(1);

    await act(async () => {
      finishDraw?.({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 1,
          ownedCounts: { "hello-kitty": 1 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
    });

    expect(
      listActiveGachaRevealGuards("player-1", localStorage),
    ).toHaveLength(1);
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await flushRevealAcknowledgement();
    expect(
      listActiveGachaRevealGuards("player-1", localStorage),
    ).toHaveLength(0);
  });

  it("reveals only its own result while another tab's draw is still guarded", async () => {
    let finishDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });

    const otherGuard = beginGachaRevealGuard(
      "player-1",
      EMPTY_SAVE,
      localStorage,
      Date.now(),
      "other-concurrent-draw",
    );
    if (!otherGuard) throw new Error("guard was not created");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: getGachaRevealGuardKey(otherGuard),
          newValue: JSON.stringify(otherGuard),
        }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 0,
            totalDraws: 2,
            ownedCounts: { "hello-kitty": 1, kuromi: 1 },
          }),
        }),
      );
    });

    await act(async () => {
      finishDraw?.({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 1,
          ownedCounts: { "hello-kitty": 1 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
      buttonWithText("圖鑑").click();
    });
    await flushRevealAcknowledgement();
    expect(container.textContent).toContain("Hello Kitty");
    expect(container.textContent).not.toContain("酷洛米");
    expect(container.textContent).toContain("1 / 57");

    act(() => {
      endGachaRevealGuard(otherGuard, localStorage);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: getGachaRevealGuardKey(otherGuard),
          newValue: null,
        }),
      );
    });
    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).toContain("2 / 57");
  });

  it("does not leak a same-character concurrent draw through reveal metadata", async () => {
    let finishDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });

    const otherGuard = beginGachaRevealGuard(
      "player-1",
      EMPTY_SAVE,
      localStorage,
      Date.now(),
      "same-character-draw",
    );
    if (!otherGuard) throw new Error("guard was not created");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: getGachaRevealGuardKey(otherGuard),
          newValue: JSON.stringify(otherGuard),
        }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 0,
            totalDraws: 1,
            ownedCounts: { "hello-kitty": 1 },
          }),
        }),
      );
    });

    await act(async () => {
      finishDraw?.({
        coinsAfter: 400,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 2,
          ownedCounts: { "hello-kitty": 2 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: false,
          ownedCount: 2,
          totalDraws: 2,
        },
      });
      await Promise.resolve();
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    await flushRevealAcknowledgement();
    const reveal = container.querySelector<HTMLElement>(
      '[data-testid="reveal-dialog"]',
    );
    expect(reveal?.dataset.isNew).toBe("true");
    expect(reveal?.dataset.ownedCount).toBe("1");

    act(() => buttonWithText("圖鑑").click());
    expect(
      container.querySelector('button[aria-label*="Hello Kitty"]')
        ?.getAttribute("aria-label"),
    ).toContain("已遇見 1 次");

    act(() => {
      endGachaRevealGuard(otherGuard, localStorage);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: getGachaRevealGuardKey(otherGuard),
          newValue: null,
        }),
      );
    });
    expect(
      container.querySelector('button[aria-label*="Hello Kitty"]')
        ?.getAttribute("aria-label"),
    ).toContain("已遇見 2 次");
  });

  it("clears a cross-tab guard when the draw fails", async () => {
    storageMocks.recordGachaAttempt.mockRejectedValue(new Error("write failed"));
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });

    expect(
      listActiveGachaRevealGuards("player-1", localStorage),
    ).toHaveLength(0);
  });

  it("only exposes collection clearing, not a local machine reset", async () => {
    await renderAt("/games/gacha");

    expect(container.textContent).not.toContain("重設機台");
    act(() => buttonWithText("圖鑑").click());

    expect(buttonWithText("清空圖鑑")).toBeInstanceOf(HTMLButtonElement);
  });

  it("records only one draw when the handle is clicked repeatedly", async () => {
    let finishDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    await renderAt("/games/gacha");

    const coinButton = buttonWithText("投入 50 代幣");
    expect(coinButton.disabled).toBe(false);
    act(() => coinButton.click());

    const handle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="轉動扭蛋機把手"]',
    );
    expect(handle).toBeInstanceOf(HTMLButtonElement);
    act(() => {
      handle?.click();
      handle?.click();
    });

    expect(storageMocks.recordGachaAttempt).toHaveBeenCalledTimes(1);
    expect(storageMocks.recordGachaAttempt).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({ kind: expect.any(String) }),
      0,
      expect.any(String),
    );

    await act(async () => {
      finishDraw?.({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 1,
          ownedCounts: { "hello-kitty": 1 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
    });

    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("Hello Kitty");
    expect(container.querySelector("img")).toBeNull();
  });

  it("buffers same-generation storage updates until a failed draw finishes", async () => {
    let failDraw: ((reason?: unknown) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((_resolve, reject) => {
        failDraw = reject;
      }),
    );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 0,
            totalDraws: 1,
            ownedCounts: { kuromi: 1 },
          }),
        }),
      );
      buttonWithText("圖鑑").click();
    });

    expect(container.textContent).not.toContain("酷洛米");
    expect(container.textContent).toContain("0 / 57");

    await act(async () => {
      failDraw?.(new Error("write failed"));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).toContain("1 / 57");
  });

  it("keeps a buffered successful draw hidden until its capsule is opened", async () => {
    let finishDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 0,
            totalDraws: 1,
            ownedCounts: { "hello-kitty": 1 },
          }),
        }),
      );
      buttonWithText("圖鑑").click();
    });
    expect(container.textContent).not.toContain("Hello Kitty");

    await act(async () => {
      finishDraw?.({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 1,
          ownedCounts: { "hello-kitty": 1 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("還有一顆待開啟膠囊");
    expect(container.textContent).not.toContain("Hello Kitty");

    act(() => buttonWithText("回到扭蛋機").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    act(() => buttonWithText("圖鑑").click());
    expect(container.textContent).toContain("Hello Kitty");
  });

  it("keeps a committed character hidden until the capsule is opened", async () => {
    storageMocks.recordGachaAttempt.mockResolvedValue({
      coinsAfter: 450,
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: { "hello-kitty": 1 },
      },
      result: {
        kind: "character",
        characterId: "hello-kitty",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    });
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Hello Kitty");
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();

    act(() => buttonWithText("圖鑑").click());
    expect(container.textContent).toContain("還有一顆待開啟膠囊");
    expect(container.textContent).not.toContain("Hello Kitty");
    expect(container.textContent).toContain("本次結果會在你親手打開後才顯示");

    act(() => buttonWithText("回到扭蛋機").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    expect(container.querySelector('[data-testid="reveal-dialog"]')?.textContent).toBe(
      "character",
    );

    act(() => buttonWithText("圖鑑").click());
    expect(container.textContent).toContain("Hello Kitty");
  });

  it("reveals an empty capsule only after it is opened", async () => {
    storageMocks.recordGachaAttempt.mockResolvedValue({
      coinsAfter: 450,
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      result: { kind: "miss", totalDraws: 1 },
    });
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="reveal-dialog"]')).toBeNull();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="膠囊已經出來，點擊開獎"]')
        ?.click();
    });
    expect(container.querySelector('[data-testid="reveal-dialog"]')?.textContent).toBe(
      "miss",
    );
  });

  it("cancels a draw when the collection reset generation changed", async () => {
    storageMocks.recordGachaAttempt.mockRejectedValue({
      code: "GACHA_RESET_CONFLICT",
    });
    storageMocks.isGachaResetConflictError.mockReturnValue(true);
    storageMocks.loadGachaCloud
      .mockResolvedValueOnce(EMPTY_SAVE)
      .mockResolvedValueOnce({
        schemaVersion: 1,
        resetVersion: 1,
        totalDraws: 0,
        ownedCounts: {},
      });
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("本次沒有開獎");
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();

    storageMocks.loadPlayerCoins.mockResolvedValueOnce(80);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("代幣 80");
    expect(container.textContent).not.toContain("沒有開獎也沒有扣款");
    expect(buttonWithText("投入 50 代幣").disabled).toBe(false);
  });

  it("immediately cancels a turning draw after a newer reset event", async () => {
    let finishFirstDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    let finishSecondDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt
      .mockReturnValueOnce(
        new Promise<CommittedGachaAttempt>((resolve) => {
          finishFirstDraw = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<CommittedGachaAttempt>((resolve) => {
          finishSecondDraw = resolve;
        }),
      );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 1,
            totalDraws: 0,
            ownedCounts: {},
          }),
        }),
      );
      await Promise.resolve();
    });

    expect(buttonWithText("投入 50 代幣").disabled).toBe(false);
    expect(container.textContent).toContain("另一個分頁重設");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });

    expect(storageMocks.recordGachaAttempt).toHaveBeenCalledTimes(2);
    expect(storageMocks.recordGachaAttempt).toHaveBeenLastCalledWith(
      "player-1",
      expect.objectContaining({ kind: expect.any(String) }),
      1,
      expect.any(String),
    );

    await act(async () => {
      finishFirstDraw?.({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 1,
          ownedCounts: { kuromi: 1 },
        },
        result: {
          kind: "character",
          characterId: "kuromi",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("雲端存檔中");
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();

    await act(async () => {
      finishSecondDraw?.({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 1,
          totalDraws: 1,
          ownedCounts: { "hello-kitty": 1 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
    });

    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("隨重設清除");
  });

  it("reloads the authoritative balance when a committed draw resolves after a reset", async () => {
    let finishDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    storageMocks.loadPlayerCoins
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(450);
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 1,
            totalDraws: 0,
            ownedCounts: {},
          }),
        }),
      );
    });
    expect(container.textContent).toContain("代幣 500");
    expect(container.textContent).toContain("代幣餘額會自動重新同步");

    await act(async () => {
      finishDraw?.({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 1,
          ownedCounts: { kuromi: 1 },
        },
        result: {
          kind: "character",
          characterId: "kuromi",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storageMocks.loadPlayerCoins).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("代幣 450");
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();
  });

  it("does not let a stale reset refresh overwrite a newer committed draw", async () => {
    let finishFirstDraw: ((result: CommittedGachaAttempt) => void) | undefined;
    let finishStaleRefresh: ((balance: number) => void) | undefined;
    storageMocks.recordGachaAttempt
      .mockReturnValueOnce(
        new Promise<CommittedGachaAttempt>((resolve) => {
          finishFirstDraw = resolve;
        }),
      )
      .mockResolvedValueOnce({
        coinsAfter: 400,
        save: {
          schemaVersion: 1,
          resetVersion: 1,
          totalDraws: 1,
          ownedCounts: { "hello-kitty": 1 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
    storageMocks.loadPlayerCoins
      .mockResolvedValueOnce(500)
      .mockReturnValueOnce(
        new Promise<number>((resolve) => {
          finishStaleRefresh = resolve;
        }),
      );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 1,
            totalDraws: 0,
            ownedCounts: {},
          }),
        }),
      );
    });

    await act(async () => {
      finishFirstDraw?.({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 1,
          ownedCounts: { kuromi: 1 },
        },
        result: {
          kind: "character",
          characterId: "kuromi",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      });
      await Promise.resolve();
    });
    expect(storageMocks.loadPlayerCoins).toHaveBeenCalledTimes(2);

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("代幣 400");

    await act(async () => {
      finishStaleRefresh?.(450);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("代幣 400");
    expect(container.textContent).not.toContain("代幣 450");
  });

  it("ignores a rejected draw after switching to another uid", async () => {
    let failDraw: ((reason?: unknown) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<CommittedGachaAttempt>((_resolve, reject) => {
        failDraw = reject;
      }),
    );
    await renderAt("/games/gacha");
    act(() => buttonWithText("投入 50 代幣").click());
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
    });

    authState.user = { uid: "player-2" };
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/games/gacha"]}>
          <GachaMachine onExit={vi.fn()} />
        </MemoryRouter>,
      );
    });
    playSoundMock.mockClear();

    await act(async () => {
      failDraw?.(new Error("late failure"));
      await Promise.resolve();
    });

    expect(playSoundMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("這次沒有開獎");
  });

  it("changes the generic capsule color for each completed draw", async () => {
    storageMocks.recordGachaAttempt
      .mockResolvedValueOnce({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 1,
          ownedCounts: { kuromi: 1 },
        },
        result: {
          kind: "character",
          characterId: "kuromi",
          isNew: true,
          ownedCount: 1,
          totalDraws: 1,
        },
      })
      .mockResolvedValueOnce({
        coinsAfter: 450,
        save: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 2,
          ownedCounts: { kuromi: 1, "hello-kitty": 1 },
        },
        result: {
          kind: "character",
          characterId: "hello-kitty",
          isNew: true,
          ownedCount: 1,
          totalDraws: 2,
        },
      });
    await renderAt("/games/gacha");

    const completeDraw = async (): Promise<string | null> => {
      act(() => buttonWithText("投入 50 代幣").click());
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
          ?.click();
        await Promise.resolve();
      });
      const capsule = container.querySelector<HTMLButtonElement>(
        'button[aria-label="膠囊已經出來，點擊開獎"]',
      );
      const variant = capsule?.getAttribute("data-capsule-variant") ?? null;
      expect(capsule?.outerHTML).not.toContain("kuromi");
      expect(capsule?.outerHTML).not.toContain("hello-kitty");
      act(() => capsule?.click());
      await flushRevealAcknowledgement();
      act(() => {
        container
          .querySelector<HTMLButtonElement>('[data-testid="reveal-dialog"]')
          ?.click();
      });
      return variant;
    };

    const firstVariant = await completeDraw();
    const secondVariant = await completeDraw();

    expect(firstVariant).not.toBeNull();
    expect(secondVariant).not.toBe(firstVariant);
    expect(storageMocks.recordGachaAttempt).toHaveBeenCalledTimes(2);
  });
});

describe("GachaMachine keyboard controls", () => {
  it.each([
    ["空白鍵", "Space" as const],
    ["Enter", "Enter" as const],
  ])("uses %s to complete the machine flow", async (_label, code) => {
    storageMocks.recordGachaAttempt.mockResolvedValue({
      coinsAfter: 450,
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      result: { kind: "miss", totalDraws: 1 },
    });
    await renderAt("/games/gacha");

    let shortcut: KeyboardEvent | undefined;
    act(() => {
      shortcut = dispatchShortcut(code);
    });
    expect(shortcut?.defaultPrevented).toBe(true);
    expect(container.textContent).toContain("代幣投入成功");

    await act(async () => {
      shortcut = dispatchShortcut(code);
      await Promise.resolve();
    });
    expect(shortcut?.defaultPrevented).toBe(true);
    expect(storageMocks.recordGachaAttempt).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();

    act(() => {
      shortcut = dispatchShortcut(code);
    });
    expect(shortcut?.defaultPrevented).toBe(true);
    expect(container.querySelector('[data-testid="reveal-dialog"]')?.textContent).toBe(
      "miss",
    );
    expect(container.textContent).toContain("鍵盤快速操作");
  });

  it("moves focus to the next keyboard-operable control", async () => {
    const animationFrames: FrameRequestCallback[] = [];
    let animationFrameId = 0;
    const animationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        animationFrames.push(callback);
        animationFrameId += 1;
        return animationFrameId;
      });
    const flushAnimationFrames = () => {
      for (const callback of animationFrames.splice(0)) callback(0);
    };
    storageMocks.recordGachaAttempt.mockResolvedValue({
      coinsAfter: 450,
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      result: { kind: "miss", totalDraws: 1 },
    });

    try {
      await renderAt("/games/gacha");

      act(() => dispatchShortcut("Space"));
      act(flushAnimationFrames);
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "轉動扭蛋機把手",
      );

      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
          ?.click();
        await Promise.resolve();
      });
      act(flushAnimationFrames);
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "膠囊已經出來，點擊開獎",
      );
    } finally {
      animationFrame.mockRestore();
    }
  });

  it("does not capture shortcuts from controls, modified keys, or open dialogs", async () => {
    await renderAt("/games/gacha");
    const input = document.createElement("input");
    const dialog = document.createElement("dialog");
    document.body.append(input, dialog);

    try {
      const controlEvent = dispatchShortcut("Space", {}, input);
      const repeatEvent = dispatchShortcut("Space", { repeat: true });
      const modifiedEvent = dispatchShortcut("Enter", { metaKey: true });
      dialog.setAttribute("open", "");
      const dialogEvent = dispatchShortcut("Space");

      expect(controlEvent.defaultPrevented).toBe(false);
      expect(repeatEvent.defaultPrevented).toBe(false);
      expect(modifiedEvent.defaultPrevented).toBe(false);
      expect(dialogEvent.defaultPrevented).toBe(false);
      expect(container.textContent).toContain("準備好了！投入 50 代幣");
      expect(storageMocks.recordGachaAttempt).not.toHaveBeenCalled();
    } finally {
      input.remove();
      dialog.remove();
    }
  });

  it("leaves collection keyboard behavior to the browser", async () => {
    await renderAt("/games/gacha?view=collection");

    const spaceEvent = dispatchShortcut("Space");
    const enterEvent = dispatchShortcut("Enter");

    expect(spaceEvent.defaultPrevented).toBe(false);
    expect(enterEvent.defaultPrevented).toBe(false);
    expect(storageMocks.recordGachaAttempt).not.toHaveBeenCalled();
  });
});

describe("GachaMachine coin economy", () => {
  it("shows the coin balance and updates it after a paid draw", async () => {
    storageMocks.loadPlayerCoins.mockResolvedValue(120);
    storageMocks.recordGachaAttempt.mockResolvedValue({
      coinsAfter: 70,
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      result: { kind: "miss", totalDraws: 1 },
    });
    await renderAt("/games/gacha");

    expect(storageMocks.loadPlayerCoins).toHaveBeenCalledWith("player-1");
    expect(container.textContent).toContain("代幣 120");
    expect(container.textContent).toContain("投入 50 代幣");

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("代幣 70");
  });

  it("blocks inserting a coin when the balance is insufficient", async () => {
    storageMocks.loadPlayerCoins.mockResolvedValue(20);
    await renderAt("/games/gacha");

    expect(container.textContent).toContain("代幣 20");
    expect(buttonWithText("投入 50 代幣").disabled).toBe(true);
    expect(container.textContent).toContain("代幣不足");
    const earnTokensLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/games/spirit"]',
    );
    expect(earnTokensLink).toBeTruthy();
    expect(earnTokensLink?.target).toBe(
      `ollie-game-${encodeURIComponent("/games/spirit")}`,
    );

    const shortcut = dispatchShortcut("Space");
    expect(shortcut.defaultPrevented).toBe(false);
    expect(storageMocks.recordGachaAttempt).not.toHaveBeenCalled();
  });

  it("recovers when the transaction rejects for insufficient coins", async () => {
    storageMocks.loadPlayerCoins.mockResolvedValue(60);
    storageMocks.recordGachaAttempt.mockRejectedValue({
      code: "GACHA_INSUFFICIENT_COINS",
      availableCoins: 10,
    });
    storageMocks.isGachaInsufficientCoinsError.mockReturnValue(true);
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("沒有開獎也沒有扣款");
    expect(container.textContent).toContain("代幣 10");
    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();
  });
});

describe("GachaMachine collection reset", () => {
  it("clears cloud progress only after destructive confirmation", async () => {
    const collectionSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 3,
      ownedCounts: { kuromi: 2 },
    };
    storageMocks.readGachaCache.mockReturnValue(collectionSave);
    storageMocks.loadGachaCloud.mockResolvedValue(collectionSave);
    storageMocks.resetGachaCollection.mockResolvedValue({
      schemaVersion: 1,
      resetVersion: 1,
      totalDraws: 0,
      ownedCounts: {},
    });
    await renderAt("/games/gacha?view=collection");

    act(() => buttonWithText("清空圖鑑").click());
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog?.textContent).toContain("57 個圖鑑項目");
    expect(dialog?.textContent).toContain("無法復原");
    expect(storageMocks.resetGachaCollection).not.toHaveBeenCalled();

    const confirmButton = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === "清空圖鑑",
    );
    await act(async () => {
      confirmButton?.click();
      await Promise.resolve();
    });

    expect(storageMocks.resetGachaCollection).toHaveBeenCalledWith("player-1");
    expect(container.textContent).toContain("0 / 57");
    expect(container.textContent).toContain("圖鑑已清空");
  });

  it("keeps the existing collection when cloud reset fails", async () => {
    const collectionSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 2,
      totalDraws: 5,
      ownedCounts: { kuromi: 3 },
    };
    storageMocks.readGachaCache.mockReturnValue(collectionSave);
    storageMocks.loadGachaCloud.mockResolvedValue(collectionSave);
    storageMocks.resetGachaCollection.mockRejectedValue(new Error("offline"));
    await renderAt("/games/gacha?view=collection");

    act(() => buttonWithText("清空圖鑑").click());
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    const confirmButton = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === "清空圖鑑",
    );
    await act(async () => {
      confirmButton?.click();
      await Promise.resolve();
    });

    expect(container.querySelector("dialog[open]")).toBe(dialog);
    expect(dialog?.textContent).toContain("原有收藏完全沒有變更");
    expect(container.textContent).toContain("酷洛米");
  });

  it("preserves a newer same-generation draw when reset resolves late", async () => {
    const collectionSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 3,
      ownedCounts: { kuromi: 3 },
    };
    let finishReset: ((save: GachaSaveV1) => void) | undefined;
    storageMocks.readGachaCache.mockReturnValue(collectionSave);
    storageMocks.loadGachaCloud.mockResolvedValue(collectionSave);
    storageMocks.resetGachaCollection.mockReturnValue(
      new Promise<GachaSaveV1>((resolve) => {
        finishReset = resolve;
      }),
    );
    await renderAt("/games/gacha?view=collection");

    act(() => buttonWithText("清空圖鑑").click());
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    const confirmButton = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === "清空圖鑑",
    );
    act(() => confirmButton?.click());

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 1,
            totalDraws: 1,
            ownedCounts: { "hello-kitty": 1 },
          }),
        }),
      );
      finishReset?.({
        schemaVersion: 1,
        resetVersion: 1,
        totalDraws: 0,
        ownedCounts: {},
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Hello Kitty");
    expect(container.textContent).toContain("1 / 57");
  });

  it("closes an unsubmitted reset confirmation when the app goes offline", async () => {
    const collectionSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: { kuromi: 1 },
    };
    storageMocks.readGachaCache.mockReturnValue(collectionSave);
    storageMocks.loadGachaCloud.mockResolvedValue(collectionSave);
    await renderAt("/games/gacha?view=collection");

    act(() => buttonWithText("清空圖鑑").click());
    expect(container.querySelector("dialog[open]")).toBeTruthy();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(container.querySelector("dialog[open]")).toBeNull();
    expect(container.textContent).toContain("尚未送出清空圖鑑");
    expect(storageMocks.resetGachaCollection).not.toHaveBeenCalled();
  });

  it("keeps a submitted reset error visible when the connection drops", async () => {
    const collectionSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: { kuromi: 1 },
    };
    let failReset: ((reason?: unknown) => void) | undefined;
    storageMocks.readGachaCache.mockReturnValue(collectionSave);
    storageMocks.loadGachaCloud.mockResolvedValue(collectionSave);
    storageMocks.resetGachaCollection.mockReturnValue(
      new Promise<GachaSaveV1>((_resolve, reject) => {
        failReset = reject;
      }),
    );
    await renderAt("/games/gacha?view=collection");

    act(() => buttonWithText("清空圖鑑").click());
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    const confirmButton = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === "清空圖鑑",
    );
    act(() => confirmButton?.click());

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    await act(async () => {
      failReset?.(new Error("offline"));
      await Promise.resolve();
    });

    expect(container.querySelector("dialog[open]")).toBe(dialog);
    expect(dialog?.textContent).toContain("原有收藏完全沒有變更");
    expect(confirmButton?.disabled).toBe(true);
  });

  it("applies a newer reset generation received from another tab", async () => {
    const collectionSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 4,
      ownedCounts: { kuromi: 2 },
    };
    storageMocks.readGachaCache.mockReturnValue(collectionSave);
    storageMocks.loadGachaCloud.mockResolvedValue(collectionSave);
    await renderAt("/games/gacha?view=collection");
    expect(container.textContent).toContain("酷洛米");

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ollie-gacha-machine-cache-v1:player-1",
          newValue: JSON.stringify({
            schemaVersion: 1,
            resetVersion: 1,
            totalDraws: 0,
            ownedCounts: {},
          }),
        }),
      );
    });

    expect(container.textContent).not.toContain("酷洛米");
    expect(container.textContent).toContain("另一個分頁重設");
  });

  it("shows a retryable error when the token balance cannot be loaded", async () => {
    storageMocks.loadPlayerCoins
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(75);

    await renderAt("/games/gacha");

    expect(container.textContent).toContain("無法載入代幣餘額");
    expect(container.textContent).not.toContain("代幣不足");
    expect(buttonWithText("投入 50 代幣").disabled).toBe(true);

    await act(async () => {
      buttonWithText("重試").click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("代幣 75");
    expect(container.textContent).not.toContain("無法載入代幣餘額");
    expect(buttonWithText("投入 50 代幣").disabled).toBe(false);
  });

  it("does not let a stale focus refresh overwrite a committed draw balance", async () => {
    storageMocks.loadPlayerCoins.mockResolvedValue(100);
    storageMocks.recordGachaAttempt.mockResolvedValue({
      coinsAfter: 50,
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      result: { kind: "miss", totalDraws: 1 },
    });
    await renderAt("/games/gacha");

    let finishRefresh: ((balance: number) => void) | undefined;
    storageMocks.loadPlayerCoins.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        finishRefresh = resolve;
      }),
    );
    act(() => window.dispatchEvent(new Event("focus")));

    act(() => buttonWithText("投入 50 代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("代幣 50");

    await act(async () => {
      finishRefresh?.(100);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("代幣 50");
    expect(container.textContent).not.toContain("代幣 100");
  });
});
