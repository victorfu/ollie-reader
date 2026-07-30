import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PetSaveV1 } from "./types";

const authState = vi.hoisted(() => ({
  user: null as { uid: string } | null,
  loading: false,
  authError: null as string | null,
  signInWithGoogle: vi.fn<() => Promise<void>>(),
}));

const settingsState = vi.hoisted(() => ({ loading: false }));
const audioSettingsState = vi.hoisted(() => ({
  sfx: 0.5,
  muted: true,
  speechEnabled: false,
}));

const hookMocks = vi.hoisted(() => ({
  speakAsync: vi.fn<(text: string) => Promise<void>>(),
  stopSpeaking: vi.fn(),
  addToast: vi.fn(),
  removeToast: vi.fn(),
  setMuted: vi.fn(),
  setSfxVolume: vi.fn(),
  setSpeechEnabled: vi.fn(),
}));

const audioMocks = vi.hoisted(() => ({
  playBubbleSound: vi.fn(),
  playEatSound: vi.fn(),
  playHeartSound: vi.fn(),
  playLullabySound: vi.fn(),
  playSelectSound: vi.fn(),
  playToySound: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  readCottageCache: vi.fn(),
  loadCottageCloud: vi.fn(),
  loadCottageCoins: vi.fn(),
  saveCottageCloud: vi.fn(),
  writeCottageCache: vi.fn(),
  commitCottageCareAction: vi.fn(),
  commitCottagePersonalizationActions: vi.fn(),
  purchaseCottageProduct: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const { createElement, forwardRef, Fragment } = await import("react");
  const motionOnlyProps = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileTap",
    "whileHover",
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
          if (!motionOnlyProps.has(key) && key !== "children") {
            domProps[key] = value;
          }
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
vi.mock("../../../hooks/useSettings", () => ({
  useSettings: () => settingsState,
}));
vi.mock("../../../hooks/useSpeechState", () => ({
  useSpeechState: () => ({
    speakAsync: hookMocks.speakAsync,
    stopSpeaking: hookMocks.stopSpeaking,
  }),
}));
vi.mock("../../../hooks/useToastQueue", () => ({
  useToastQueue: () => ({
    toasts: [],
    addToast: hookMocks.addToast,
    removeToast: hookMocks.removeToast,
  }),
}));
vi.mock("../../../utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("./useAudioSettings", () => ({
  useAudioSettings: () => ({
    settings: audioSettingsState,
    setMuted: hookMocks.setMuted,
    setSfxVolume: hookMocks.setSfxVolume,
    setSpeechEnabled: hookMocks.setSpeechEnabled,
  }),
}));
vi.mock("./audio", () => audioMocks);

vi.mock("./storage", () => {
  class CottageAlreadyOwnedError extends Error {}
  class CottageInsufficientCoinsError extends Error {
    availableCoins = 0;
  }

  return {
    CottageAlreadyOwnedError,
    CottageInsufficientCoinsError,
    compareCottageSaveVersions: (left: PetSaveV1, right: PetSaveV1) =>
      Math.sign(left.revision - right.revision),
    getCottageCacheKey: (uid: string) => `cloud-cottage:${uid}`,
    parseCottageCacheValue: () => null,
    readCottageCache: storageMocks.readCottageCache,
    loadCottageCloud: storageMocks.loadCottageCloud,
    loadCottageCoins: storageMocks.loadCottageCoins,
    saveCottageCloud: storageMocks.saveCottageCloud,
    writeCottageCache: storageMocks.writeCottageCache,
    commitCottageCareAction: storageMocks.commitCottageCareAction,
    commitCottagePersonalizationActions:
      storageMocks.commitCottagePersonalizationActions,
    purchaseCottageProduct: storageMocks.purchaseCottageProduct,
  };
});

vi.mock("./ui/CottageScene", () => ({
  CottageScene: ({
    speech,
    wishLabel,
  }: {
    speech: { en: string; zh: string } | null;
    wishLabel: string;
  }) => (
    <section data-testid="cottage-scene">
      <p>{wishLabel}</p>
      {speech ? <p>{speech.en} {speech.zh}</p> : null}
    </section>
  ),
}));

vi.mock("./ui/CottageStatusBar", () => ({
  CottageStatusBar: ({
    fullness,
    clean,
    mood,
  }: {
    fullness: number;
    clean: number;
    mood: number;
  }) => (
    <output
      data-testid="cottage-status"
      data-fullness={Math.round(fullness)}
      data-clean={Math.round(clean)}
      data-mood={Math.round(mood)}
    />
  ),
}));

vi.mock("./ui/CottagePanel", () => ({
  CottagePanel: ({
    open,
    title,
    onClose,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label={`關閉${title}`}>
          關閉
        </button>
        {children}
        {footer}
      </section>
    ) : null,
}));

import CloudCottage from "./CloudCottage";

type RenderedGameState = {
  sync: string;
  time: { now: number; period: string };
  action: string;
  bath: { rubCount: number; readyToRinse: boolean };
  personalizationDraft: null | {
    mode: string;
    room?: PetSaveV1["room"];
    equipped?: PetSaveV1["equipped"];
  };
  room: PetSaveV1["room"];
  pet: {
    stats: { fullness: number; clean: number; mood: number };
    bond: { total: number };
  };
  inventory: {
    freeFood: { milk: number; cookie: number };
    snacks: Record<string, number>;
  };
  coins: number | null;
};

let container: HTMLDivElement;
let root: Root;

function button(selector: string): HTMLButtonElement {
  const element = container.querySelector(selector);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`button not found: ${selector}`);
  }
  return element;
}

function gameState(): RenderedGameState {
  if (!window.render_game_to_text) {
    throw new Error("render_game_to_text is not installed");
  }
  return JSON.parse(window.render_game_to_text()) as RenderedGameState;
}

async function renderCottage(onExit = vi.fn()): Promise<ReturnType<typeof vi.fn>> {
  await act(async () => {
    root.render(<CloudCottage onExit={onExit} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return onExit;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-30T12:00:00+08:00"));
  window.history.replaceState({}, "", "/games/cottage");
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
  authState.user = null;
  authState.loading = false;
  authState.authError = null;
  authState.signInWithGoogle.mockReset().mockResolvedValue(undefined);
  settingsState.loading = false;
  audioSettingsState.sfx = 0.5;
  audioSettingsState.muted = true;
  audioSettingsState.speechEnabled = false;
  hookMocks.speakAsync.mockReset().mockResolvedValue(undefined);
  hookMocks.stopSpeaking.mockReset();
  hookMocks.addToast.mockReset();
  hookMocks.removeToast.mockReset();
  hookMocks.setMuted.mockReset();
  hookMocks.setSfxVolume.mockReset();
  hookMocks.setSpeechEnabled.mockReset();
  Object.values(audioMocks).forEach((mock) => mock.mockReset());
  storageMocks.readCottageCache.mockReset().mockReturnValue(null);
  storageMocks.loadCottageCloud.mockReset();
  storageMocks.loadCottageCoins.mockReset();
  storageMocks.saveCottageCloud.mockReset().mockImplementation(
    async (_uid: string, save: PetSaveV1) => save,
  );
  storageMocks.writeCottageCache.mockReset().mockResolvedValue(undefined);
  storageMocks.commitCottageCareAction.mockReset();
  storageMocks.commitCottagePersonalizationActions.mockReset();
  storageMocks.purchaseCottageProduct.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("CloudCottage access", () => {
  it("keeps cloud saves behind the Google sign-in gate", async () => {
    const onExit = await renderCottage();

    expect(container.textContent).toContain("登入後回到小窩");
    expect(container.textContent).toContain("都會安全存在你的雲端存檔");
    expect(storageMocks.loadCottageCloud).not.toHaveBeenCalled();

    await act(async () => {
      button("button.btn-primary").click();
      await Promise.resolve();
    });
    expect(authState.signInWithGoogle).toHaveBeenCalledTimes(1);

    act(() => button("header button").click());
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe("CloudCottage demo care loop", () => {
  it("lets the player feed, complete the bath gesture, and buy a snack", async () => {
    window.history.replaceState({}, "", "/games/cottage?demo=1");
    await renderCottage();

    const initial = gameState();
    expect(initial.sync).toBe("demo");
    expect(initial.coins).toBe(500);
    expect(initial.pet.stats.fullness).toBe(70);
    expect(initial.pet.stats.clean).toBe(75);

    act(() => button('[data-toolbar="food"]').click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "點心櫃",
    );
    act(() => button('[data-food-id="milk"]').click());

    const afterFood = gameState();
    expect(afterFood.pet.stats.fullness).toBe(100);
    expect(afterFood.inventory.freeFood.milk).toBe(1);
    expect(afterFood.pet.bond.total).toBeGreaterThan(initial.pet.bond.total);
    expect(audioMocks.playEatSound).toHaveBeenCalledTimes(1);

    act(() => button('[data-toolbar="bath"]').click());
    const rinse = button("[data-bath-rinse]");
    expect(rinse.disabled).toBe(true);
    expect(gameState().bath).toEqual({ rubCount: 0, readyToRinse: false });
    act(() => {
      const rub = button("[data-bath-rub]");
      rub.click();
      rub.click();
      rub.click();
    });
    expect(button("[data-bath-rinse]").disabled).toBe(false);
    expect(gameState().bath).toEqual({ rubCount: 3, readyToRinse: true });
    act(() => button("[data-bath-rinse]").click());

    const afterBath = gameState();
    expect(afterBath.pet.stats.clean).toBe(100);
    expect(afterBath.pet.bond.total).toBeGreaterThan(afterFood.pet.bond.total);
    expect(audioMocks.playBubbleSound).toHaveBeenCalledTimes(4);

    act(() => button('[data-toolbar="shop"]').click());
    await act(async () => {
      button('[data-product-id="apple"]').click();
      await Promise.resolve();
    });

    const afterPurchase = gameState();
    expect(afterPurchase.coins).toBe(485);
    expect(afterPurchase.inventory.snacks.apple).toBe(1);
    expect(container.textContent).toContain("目前有 1");
    expect(storageMocks.purchaseCottageProduct).not.toHaveBeenCalled();
  });

  it("advances its test clock by exactly the requested duration", async () => {
    window.history.replaceState({}, "", "/games/cottage?demo=1");
    await renderCottage();
    const initialNow = gameState().time.now;

    await act(async () => window.advanceTime?.(1_234));
    expect(gameState().time.now).toBe(initialNow + 1_234);

    await act(async () => window.advanceTime?.(4_321));
    expect(gameState().time.now).toBe(initialNow + 5_555);
  });

  it("occasionally takes a gentle daytime nap while idle", async () => {
    window.history.replaceState({}, "", "/games/cottage?demo=1");
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    await renderCottage();

    act(() => vi.advanceTimersByTime(1_450));
    act(() => vi.advanceTimersByTime(24_000));
    expect(gameState().action).toBe("nap");

    random.mockRestore();
  });

  it("reports unsaved room-editor previews through render_game_to_text", async () => {
    window.history.replaceState({}, "", "/games/cottage?demo=1");
    await renderCottage();

    act(() => button('[data-toolbar="decorate"]').click());
    const bed = button('button[data-placed-furniture-id="cloud-bed"]');
    act(() => {
      bed.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    });

    const preview = gameState();
    expect(preview.personalizationDraft?.mode).toBe("decorate");
    expect(preview.room.placed.find((item) => item.id === "cloud-bed")?.x).toBe(75);
    expect(preview.personalizationDraft?.room).toEqual(preview.room);
  });

  it("replays the entrance greeting TTS after settings finish loading", async () => {
    window.history.replaceState({}, "", "/games/cottage?demo=1");
    settingsState.loading = true;
    audioSettingsState.speechEnabled = true;
    const onExit = vi.fn();
    await renderCottage(onExit);
    expect(hookMocks.speakAsync).not.toHaveBeenCalled();

    settingsState.loading = false;
    await act(async () => {
      root.render(<CloudCottage onExit={onExit} />);
      await Promise.resolve();
    });

    expect(hookMocks.speakAsync).toHaveBeenCalledWith("Good afternoon!");
  });
});
