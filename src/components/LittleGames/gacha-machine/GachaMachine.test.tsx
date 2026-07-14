import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GachaDrawResult, GachaSaveV1 } from "./gachaTypes";

const authState = vi.hoisted(() => ({
  user: { uid: "player-1" } as { uid: string } | null,
  loading: false,
  authError: null as string | null,
  signInWithGoogle: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  readGachaCache: vi.fn(),
  loadGachaCloud: vi.fn(),
  recordGachaDraw: vi.fn(),
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
vi.mock("../../../services/gameService", () => ({ playSound: vi.fn() }));
vi.mock("../../../utils/logger", () => ({
  logger: { error: vi.fn() },
}));
vi.mock("./gachaStorage", () => storageMocks);
vi.mock("./GachaRevealDialog", () => ({
  GachaRevealDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="reveal-dialog" /> : null,
}));

import GachaMachine from "./GachaMachine";

let container: HTMLDivElement;
let root: Root;

const EMPTY_SAVE: GachaSaveV1 = {
  schemaVersion: 1,
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
  storageMocks.readGachaCache.mockReset().mockReturnValue(null);
  storageMocks.loadGachaCloud.mockReset().mockResolvedValue(EMPTY_SAVE);
  storageMocks.recordGachaDraw.mockReset();
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
});

describe("GachaMachine draw guard", () => {
  it("records only one draw when the handle is clicked repeatedly", async () => {
    let finishDraw: ((result: GachaDrawResult) => void) | undefined;
    storageMocks.recordGachaDraw.mockReturnValue(
      new Promise<GachaDrawResult>((resolve) => {
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

    expect(storageMocks.recordGachaDraw).toHaveBeenCalledTimes(1);
    expect(storageMocks.recordGachaDraw).toHaveBeenCalledWith(
      "player-1",
      expect.any(String),
    );

    await act(async () => {
      finishDraw?.({
        characterId: "hello-kitty",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      });
      await Promise.resolve();
    });

    expect(
      container.querySelector('button[aria-label="膠囊已經出來，點擊開獎"]'),
    ).toBeTruthy();
  });
});
