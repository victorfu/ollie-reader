import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppliedGachaAttempt, GachaSaveV1 } from "./gachaTypes";

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
  isGachaResetConflictError: vi.fn(() => false),
  parseGachaCacheValue: vi.fn((raw: string | null) =>
    raw ? (JSON.parse(raw) as GachaSaveV1) : null,
  ),
  readGachaCache: vi.fn(),
  loadGachaCloud: vi.fn(),
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
  }: {
    isOpen: boolean;
    result: AppliedGachaAttempt["result"] | null;
  }) =>
    isOpen ? <div data-testid="reveal-dialog">{result?.kind}</div> : null,
}));

import GachaMachine from "./GachaMachine";

let container: HTMLDivElement;
let root: Root;

const EMPTY_SAVE: GachaSaveV1 = {
  schemaVersion: 1,
  resetVersion: 0,
  totalDraws: 0,
  ownedCounts: {},
};

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

async function renderAt(entry: string): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <GachaMachine onExit={vi.fn()} />
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

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  setOnline(true);
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
  storageMocks.loadGachaCloud.mockReset().mockResolvedValue(EMPTY_SAVE);
  storageMocks.recordGachaAttempt.mockReset();
  storageMocks.resetGachaCollection.mockReset();
  storageMocks.isGachaResetConflictError.mockReset().mockReturnValue(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("GachaMachine page states", () => {
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
  it("returns an inserted coin when the local machine is reset", async () => {
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入免費代幣").click());
    const resetButton = buttonWithText("重設機台");
    expect(resetButton.disabled).toBe(false);
    act(() => resetButton.click());

    expect(buttonWithText("投入免費代幣").disabled).toBe(false);
    expect(storageMocks.recordGachaAttempt).not.toHaveBeenCalled();
    expect(container.textContent).toContain("代幣已退回");
  });

  it("records only one draw when the handle is clicked repeatedly", async () => {
    let finishDraw: ((result: AppliedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<AppliedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    await renderAt("/games/gacha");

    const coinButton = buttonWithText("投入免費代幣");
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
    );

    await act(async () => {
      finishDraw?.({
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
      new Promise<AppliedGachaAttempt>((_resolve, reject) => {
        failDraw = reject;
      }),
    );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入免費代幣").click());
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
    expect(container.textContent).toContain("0 / 37");

    await act(async () => {
      failDraw?.(new Error("write failed"));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("酷洛米");
    expect(container.textContent).toContain("1 / 37");
  });

  it("keeps a buffered successful draw hidden until its capsule is opened", async () => {
    let finishDraw: ((result: AppliedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<AppliedGachaAttempt>((resolve) => {
        finishDraw = resolve;
      }),
    );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入免費代幣").click());
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

    act(() => buttonWithText("投入免費代幣").click());
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
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      result: { kind: "miss", totalDraws: 1 },
    });
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入免費代幣").click());
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

    act(() => buttonWithText("投入免費代幣").click());
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
  });

  it("immediately cancels a turning draw after a newer reset event", async () => {
    let finishFirstDraw: ((result: AppliedGachaAttempt) => void) | undefined;
    let finishSecondDraw: ((result: AppliedGachaAttempt) => void) | undefined;
    storageMocks.recordGachaAttempt
      .mockReturnValueOnce(
        new Promise<AppliedGachaAttempt>((resolve) => {
          finishFirstDraw = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<AppliedGachaAttempt>((resolve) => {
          finishSecondDraw = resolve;
        }),
      );
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入免費代幣").click());
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

    expect(buttonWithText("投入免費代幣").disabled).toBe(false);
    expect(container.textContent).toContain("另一個分頁重設");

    act(() => buttonWithText("投入免費代幣").click());
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
    );

    await act(async () => {
      finishFirstDraw?.({
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

  it("ignores a rejected draw after switching to another uid", async () => {
    let failDraw: ((reason?: unknown) => void) | undefined;
    storageMocks.recordGachaAttempt.mockReturnValue(
      new Promise<AppliedGachaAttempt>((_resolve, reject) => {
        failDraw = reject;
      }),
    );
    await renderAt("/games/gacha");
    act(() => buttonWithText("投入免費代幣").click());
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

  it("resets the local machine without undoing a committed draw", async () => {
    storageMocks.recordGachaAttempt.mockResolvedValue({
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
    await renderAt("/games/gacha");

    act(() => buttonWithText("投入免費代幣").click());
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="轉動扭蛋機把手"]')
        ?.click();
      await Promise.resolve();
    });
    act(() => buttonWithText("重設機台").click());

    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeNull();
    expect(container.textContent).toContain("已完成的抽取仍保存在雲端圖鑑");
    expect(storageMocks.resetGachaCollection).not.toHaveBeenCalled();

    act(() => buttonWithText("圖鑑").click());
    expect(container.textContent).toContain("酷洛米");
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
    expect(container.textContent).toContain("0 / 37");
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
    expect(container.textContent).toContain("1 / 37");
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
});
