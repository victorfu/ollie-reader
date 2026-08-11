import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialPetSave, normalizePetSave } from "./logic/petState";
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
  parseCottageCacheValue: vi.fn(),
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
    parseCottageCacheValue: storageMocks.parseCottageCacheValue,
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
  panel: string | null;
  personalizationMode: string | null;
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
    sleeping: boolean;
    stats: { fullness: number; clean: number; mood: number };
    bond: { total: number };
  };
  inventory: {
    freeFood: { milk: number; cookie: number };
    snacks: Record<string, number>;
    outfits: string[];
  };
  wish: {
    id: string;
    label: string;
    progress: number;
    target: number;
    fulfilled: boolean;
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

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderSignedInCottage(
  initial: PetSaveV1,
  uid = "cloud-reader",
): Promise<void> {
  authState.user = { uid };
  storageMocks.readCottageCache.mockReturnValue(initial);
  storageMocks.loadCottageCloud.mockResolvedValue(initial);
  storageMocks.loadCottageCoins.mockResolvedValue(120);
  await renderCottage();
  await flushAsyncWork();
}

async function setOnlineState(online: boolean): Promise<void> {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  await act(async () => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
    await Promise.resolve();
  });
  await flushAsyncWork();
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
  storageMocks.parseCottageCacheValue.mockReset().mockReturnValue(null);
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

describe("CloudCottage network transitions", () => {
  it("keeps an open room editor and its unsaved draft without a readable cache", async () => {
    const initial = createInitialPetSave(Date.now());
    await renderSignedInCottage(initial);

    act(() => button('[data-toolbar="decorate"]').click());
    const bed = button('button[data-placed-furniture-id="cloud-bed"]');
    act(() => {
      bed.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    });
    expect(gameState().personalizationDraft?.room?.placed[0]?.x).toBe(75);

    storageMocks.readCottageCache.mockReturnValue(null);
    await setOnlineState(false);
    expect(gameState().personalizationMode).toBe("decorate");
    expect(gameState().personalizationDraft?.room?.placed[0]?.x).toBe(75);
    expect(container.querySelector("[data-room-editor]")).not.toBeNull();

    await setOnlineState(true);
    expect(gameState().personalizationMode).toBe("decorate");
    expect(gameState().personalizationDraft?.room?.placed[0]?.x).toBe(75);
  });

  it("keeps an unsaved wardrobe preview across no-cache network flips", async () => {
    const base = createInitialPetSave(Date.now());
    const initial: PetSaveV1 = {
      ...base,
      inventory: {
        ...base.inventory,
        outfits: ["strawberry-clip"],
      },
    };
    let resolveCloud!: (save: PetSaveV1) => void;
    const cloudLoad = new Promise<PetSaveV1>((resolve) => {
      resolveCloud = resolve;
    });
    authState.user = { uid: "cloud-reader" };
    storageMocks.readCottageCache.mockReturnValue(initial);
    storageMocks.loadCottageCloud.mockReturnValue(cloudLoad);
    storageMocks.loadCottageCoins.mockResolvedValue(120);
    await renderCottage();
    await act(async () => {
      resolveCloud(initial);
      await cloudLoad;
    });
    await flushAsyncWork();
    expect(gameState().inventory.outfits).toContain("strawberry-clip");

    act(() => button('[data-toolbar="wardrobe"]').click());
    const outfit = container.querySelector<HTMLInputElement>(
      'input[data-outfit-id="strawberry-clip"][data-slot="head"]',
    );
    expect(outfit).not.toBeNull();
    act(() => outfit?.click());
    expect(gameState().personalizationDraft?.equipped?.head).toBe(
      "strawberry-clip",
    );

    storageMocks.readCottageCache.mockReturnValue(null);
    await setOnlineState(false);
    expect(gameState().personalizationMode).toBe("wardrobe");
    expect(gameState().personalizationDraft?.equipped?.head).toBe(
      "strawberry-clip",
    );
    expect(container.querySelector("[data-wardrobe]")).not.toBeNull();

    await setOnlineState(true);
    expect(gameState().personalizationMode).toBe("wardrobe");
    expect(gameState().personalizationDraft?.equipped?.head).toBe(
      "strawberry-clip",
    );
  });

  it("keeps ordinary care panels open when connectivity changes", async () => {
    await renderSignedInCottage(createInitialPetSave(Date.now()));

    act(() => button('[data-toolbar="food"]').click());
    expect(gameState().panel).toBe("food");

    await setOnlineState(false);
    expect(gameState().panel).toBe("food");
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "點心櫃",
    );

    await setOnlineState(true);
    expect(gameState().panel).toBe("food");
  });

  it("restores and queues the captured optimistic care result after a transaction failure", async () => {
    const initial = createInitialPetSave(Date.now());
    let rejectCare!: (reason?: unknown) => void;
    storageMocks.commitCottageCareAction.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectCare = reject;
      }),
    );
    await renderSignedInCottage(initial);
    storageMocks.writeCottageCache.mockClear();

    act(() => button('[data-toolbar="food"]').click());
    act(() => button('[data-food-id="milk"]').click());

    const optimisticWrite = storageMocks.writeCottageCache.mock.calls.find(
      ([uid, candidate]) =>
        uid === "cloud-reader"
        && (candidate as PetSaveV1).freeFood.milk === 1,
    );
    expect(optimisticWrite).toBeDefined();
    const optimistic = optimisticWrite?.[1] as PetSaveV1;
    expect(optimistic.stats.fullness).toBe(100);

    // Reproduce the original race: the connectivity effect rehydrates the
    // stale cached snapshot while the care transaction is still pending.
    await setOnlineState(false);
    expect(gameState().inventory.freeFood.milk).toBe(2);

    await act(async () => {
      rejectCare(new Error("network changed"));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushAsyncWork();

    expect(gameState().inventory.freeFood.milk).toBe(1);
    expect(gameState().pet.stats.fullness).toBe(100);
    const capturedWrites = storageMocks.writeCottageCache.mock.calls.filter(
      ([uid, candidate]) =>
        uid === "cloud-reader"
        && (candidate as PetSaveV1).freeFood.milk === 1,
    );
    expect(capturedWrites).toHaveLength(2);
    expect(capturedWrites[1]?.[1]).toEqual(optimistic);
  });

  it("never reuses the previous uid's in-memory save after a failed account load", async () => {
    const accountA = {
      ...createInitialPetSave(Date.now()),
      revision: 100,
      bond: {
        total: 900,
        earnedToday: 0,
        earnedDate: "2026-07-30",
      },
    };
    await renderSignedInCottage(accountA);
    expect(gameState().pet.bond.total).toBe(900);

    let rejectAccountB!: (reason?: unknown) => void;
    const failedAccountBLoad = new Promise<PetSaveV1>((_resolve, reject) => {
      rejectAccountB = reject;
    });
    authState.user = { uid: "reconnect-reader" };
    storageMocks.readCottageCache.mockReturnValue(null);
    storageMocks.loadCottageCloud.mockReturnValue(failedAccountBLoad);
    await act(async () => {
      root.render(<CloudCottage onExit={vi.fn()} />);
      await Promise.resolve();
    });
    await act(async () => {
      rejectAccountB(new Error("first load failed"));
      await Promise.resolve();
    });
    await flushAsyncWork();
    expect(gameState().sync).toBe("error");

    storageMocks.writeCottageCache.mockClear();
    storageMocks.saveCottageCloud.mockClear();
    await setOnlineState(false);

    expect(storageMocks.writeCottageCache).not.toHaveBeenCalled();
    expect(storageMocks.saveCottageCloud).not.toHaveBeenCalled();

    const accountB = {
      ...createInitialPetSave(Date.now()),
      revision: 1,
      bond: {
        total: 50,
        earnedToday: 0,
        earnedDate: "2026-07-30",
      },
    };
    storageMocks.loadCottageCloud.mockResolvedValue(accountB);
    await setOnlineState(true);

    expect(gameState().sync).toBe("cloud");
    expect(gameState().pet.bond.total).toBe(50);
    const accountBWrites = storageMocks.writeCottageCache.mock.calls.filter(
      ([targetUid]) => targetUid === "reconnect-reader",
    );
    expect(accountBWrites).toHaveLength(1);
    expect(accountBWrites[0]?.[1]).toEqual(
      expect.objectContaining({
        bond: expect.objectContaining({ total: 50 }),
      }),
    );
  });

  it("does not carry a pending cloud write into the next uid's reconnect", async () => {
    const accountA = {
      ...createInitialPetSave(Date.now()),
      revision: 100,
      bond: {
        total: 900,
        earnedToday: 0,
        earnedDate: "2026-07-30",
      },
    };
    await renderSignedInCottage(accountA);

    storageMocks.saveCottageCloud.mockRejectedValueOnce(
      new Error("account A went offline"),
    );
    act(() => button('[data-toolbar="food"]').click());
    act(() => button('[data-food-id="milk"]').click());
    await flushAsyncWork();
    expect(gameState().sync).toBe("offline");

    let resolveAccountB!: (save: PetSaveV1) => void;
    const accountBLoad = new Promise<PetSaveV1>((resolve) => {
      resolveAccountB = resolve;
    });
    authState.user = { uid: "pending-write-reader" };
    storageMocks.readCottageCache.mockReturnValue(null);
    storageMocks.loadCottageCloud.mockClear();
    storageMocks.loadCottageCloud.mockReturnValue(accountBLoad);
    storageMocks.saveCottageCloud.mockClear();
    await act(async () => {
      root.render(<CloudCottage onExit={vi.fn()} />);
      await Promise.resolve();
    });

    expect(gameState().sync).toBe("loading");
    expect(storageMocks.loadCottageCloud).toHaveBeenCalledTimes(1);

    const accountB = {
      ...createInitialPetSave(Date.now()),
      revision: 1,
      bond: {
        total: 50,
        earnedToday: 0,
        earnedDate: "2026-07-30",
      },
    };
    await act(async () => {
      resolveAccountB(accountB);
      await accountBLoad;
    });
    await flushAsyncWork();

    expect(gameState().sync).toBe("cloud");
    expect(gameState().pet.bond.total).toBe(50);
    expect(storageMocks.loadCottageCloud).toHaveBeenCalledTimes(1);
    const accountBSaves = storageMocks.saveCottageCloud.mock.calls.filter(
      ([targetUid]) => targetUid === "pending-write-reader",
    );
    expect(accountBSaves).toHaveLength(1);
    expect(accountBSaves[0]?.[1]).toEqual(
      expect.objectContaining({
        bond: expect.objectContaining({ total: 50 }),
      }),
    );
  });

  it("accepts an active uid storage save without comparing the previous owner's revision", async () => {
    const accountA = {
      ...createInitialPetSave(Date.now()),
      revision: 100,
      bond: {
        total: 900,
        earnedToday: 0,
        earnedDate: "2026-07-30",
      },
    };
    await renderSignedInCottage(accountA);

    const pendingLoad = new Promise<PetSaveV1>(() => undefined);
    authState.user = { uid: "storage-reader" };
    storageMocks.readCottageCache.mockReturnValue(null);
    storageMocks.loadCottageCloud.mockReturnValue(pendingLoad);
    await act(async () => {
      root.render(<CloudCottage onExit={vi.fn()} />);
      await Promise.resolve();
    });

    const accountB = {
      ...createInitialPetSave(Date.now()),
      revision: 1,
      bond: {
        total: 50,
        earnedToday: 0,
        earnedDate: "2026-07-30",
      },
    };
    storageMocks.parseCottageCacheValue.mockReturnValue(accountB);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "cloud-cottage:storage-reader",
        newValue: JSON.stringify(accountB),
      }));
    });

    expect(gameState().pet.bond.total).toBe(50);
  });
});

describe("CloudCottage sleep transitions", () => {
  const bedtime = new Date("2026-07-31T06:59:00+08:00").getTime();
  const wakeAt = new Date("2026-07-31T07:00:00+08:00").getTime();
  const localDate = "2026-07-31";

  function bedtimeSave(wishId: string): PetSaveV1 {
    const initial = createInitialPetSave(bedtime, localDate);
    return {
      ...initial,
      wish: {
        date: localDate,
        wishId,
        fulfilled: false,
        progress: 0,
        target: wishId === "pet-five" ? 5 : 1,
      },
    };
  }

  it("keeps an ordinary sleep active until its deadline, then wakes and persists once", async () => {
    vi.setSystemTime(bedtime);
    await renderSignedInCottage(bedtimeSave("pet-five"));

    act(() => button('[data-toolbar="sleep"]').click());
    expect(gameState().pet.sleeping).toBe(true);
    expect(gameState().action).toBe("sleep");

    await flushAsyncWork();
    storageMocks.writeCottageCache.mockClear();
    storageMocks.saveCottageCloud.mockClear();

    await act(async () => window.advanceTime?.(wakeAt - bedtime - 1));
    expect(gameState().pet.sleeping).toBe(true);
    expect(gameState().action).toBe("sleep");
    expect(storageMocks.writeCottageCache).not.toHaveBeenCalled();

    await act(async () => window.advanceTime?.(1));
    await flushAsyncWork();

    expect(gameState().pet.sleeping).toBe(false);
    expect(gameState().action).toBe("wake");
    expect(container.textContent).toContain("醒來看到你真開心！");
    expect(storageMocks.writeCottageCache).toHaveBeenCalledTimes(1);
    expect(storageMocks.writeCottageCache).toHaveBeenCalledWith(
      "cloud-reader",
      expect.objectContaining({ sleepingUntil: null }),
    );
    expect(storageMocks.saveCottageCloud).toHaveBeenCalledTimes(1);
    expect(storageMocks.saveCottageCloud).toHaveBeenCalledWith(
      "cloud-reader",
      expect.objectContaining({ sleepingUntil: null }),
    );
  });

  it("wakes after wish celebration and heart burst replace the sleep action", async () => {
    vi.setSystemTime(bedtime);
    const initial = bedtimeSave("say-good-night");
    initial.revision = 10;
    initial.bond = {
      total: 10,
      earnedToday: 0,
      earnedDate: localDate,
    };
    await renderSignedInCottage(initial, "wish-reader");
    expect(gameState().wish.id).toBe("say-good-night");
    expect(gameState().pet.bond.total).toBe(10);

    act(() => button('[data-toolbar="sleep"]').click());
    expect(gameState().pet.sleeping).toBe(true);
    expect(gameState().action).toBe("heartBurst");
    expect(hookMocks.addToast).toHaveBeenCalledWith(
      "今日心願完成！親密度 +10 💕",
      "success",
      4_000,
    );

    act(() => vi.advanceTimersByTime(2_200));
    expect(gameState().action).toBe("idle");

    await flushAsyncWork();
    storageMocks.writeCottageCache.mockClear();
    storageMocks.saveCottageCloud.mockClear();
    await act(async () => window.advanceTime?.(wakeAt - bedtime));
    await flushAsyncWork();

    expect(gameState().pet.sleeping).toBe(false);
    expect(gameState().action).toBe("wake");
    expect(storageMocks.writeCottageCache).toHaveBeenCalledTimes(1);
    expect(storageMocks.writeCottageCache).toHaveBeenCalledWith(
      "wish-reader",
      expect.objectContaining({ sleepingUntil: null }),
    );
    expect(storageMocks.saveCottageCloud).toHaveBeenCalledTimes(1);
  });

  it("does not replay a wake ceremony for an expired sleep normalized during reload", async () => {
    const reloadAt = new Date("2026-07-31T07:05:00+08:00").getTime();
    vi.setSystemTime(reloadAt);
    const expired = {
      ...bedtimeSave("pet-five"),
      sleepingUntil: wakeAt,
    };
    const normalized = normalizePetSave(expired, reloadAt, localDate);
    expect(normalized.sleepingUntil).toBeNull();

    await renderSignedInCottage(normalized);
    expect(gameState().pet.sleeping).toBe(false);
    expect(gameState().action).toBe("idle");

    storageMocks.writeCottageCache.mockClear();
    storageMocks.saveCottageCloud.mockClear();
    await act(async () => window.advanceTime?.(60_000));
    await flushAsyncWork();

    expect(gameState().action).toBe("idle");
    expect(storageMocks.writeCottageCache).not.toHaveBeenCalled();
    expect(storageMocks.saveCottageCloud).not.toHaveBeenCalled();
  });

  it("does not assign the previous account's deadline to a uid whose load is pending", async () => {
    vi.setSystemTime(bedtime);
    const accountA = {
      ...bedtimeSave("pet-five"),
      revision: 10,
      sleepingUntil: wakeAt,
    };
    await renderSignedInCottage(accountA);
    expect(gameState().pet.sleeping).toBe(true);

    let resolveAccountB!: (save: PetSaveV1) => void;
    const accountBLoad = new Promise<PetSaveV1>((resolve) => {
      resolveAccountB = resolve;
    });
    authState.user = { uid: "pending-reader" };
    storageMocks.readCottageCache.mockReturnValue(null);
    storageMocks.loadCottageCloud.mockReturnValue(accountBLoad);
    await act(async () => {
      root.render(<CloudCottage onExit={vi.fn()} />);
      await Promise.resolve();
    });
    expect(gameState().sync).toBe("loading");

    storageMocks.writeCottageCache.mockClear();
    storageMocks.saveCottageCloud.mockClear();
    await act(async () => window.advanceTime?.(wakeAt - bedtime));
    await flushAsyncWork();

    expect(storageMocks.writeCottageCache).not.toHaveBeenCalled();
    expect(storageMocks.saveCottageCloud).not.toHaveBeenCalled();
    expect(gameState().sync).toBe("loading");

    const accountBWakeAt = wakeAt + 120_000;
    const accountB = {
      ...bedtimeSave("pet-five"),
      revision: 20,
      sleepingUntil: accountBWakeAt,
    };
    await act(async () => {
      resolveAccountB(accountB);
      await accountBLoad;
    });
    await flushAsyncWork();
    expect(gameState().pet.sleeping).toBe(true);

    storageMocks.writeCottageCache.mockClear();
    storageMocks.saveCottageCloud.mockClear();
    await act(async () => window.advanceTime?.(accountBWakeAt - wakeAt));
    await flushAsyncWork();

    expect(gameState().pet.sleeping).toBe(false);
    expect(gameState().action).toBe("wake");
    expect(storageMocks.writeCottageCache).toHaveBeenCalledTimes(1);
    expect(storageMocks.writeCottageCache).toHaveBeenCalledWith(
      "pending-reader",
      expect.objectContaining({ sleepingUntil: null }),
    );
    expect(storageMocks.saveCottageCloud).toHaveBeenCalledTimes(1);
    expect(storageMocks.saveCottageCloud).toHaveBeenCalledWith(
      "pending-reader",
      expect.objectContaining({ sleepingUntil: null }),
    );
  });

  it("ignores a queued wake save that resolves after the active uid changes", async () => {
    vi.setSystemTime(bedtime);
    const accountA = {
      ...bedtimeSave("pet-five"),
      revision: 100,
      sleepingUntil: wakeAt,
    };
    await renderSignedInCottage(accountA);

    let queuedWakeSave!: PetSaveV1;
    let resolveQueuedWake!: (save: PetSaveV1) => void;
    storageMocks.saveCottageCloud.mockImplementationOnce(
      async (_uid: string, next: PetSaveV1) => {
        queuedWakeSave = next;
        return new Promise<PetSaveV1>((resolve) => {
          resolveQueuedWake = resolve;
        });
      },
    );
    await act(async () => window.advanceTime?.(wakeAt - bedtime));
    await flushAsyncWork();
    expect(queuedWakeSave.sleepingUntil).toBeNull();

    let resolveAccountB!: (save: PetSaveV1) => void;
    const accountBLoad = new Promise<PetSaveV1>((resolve) => {
      resolveAccountB = resolve;
    });
    const accountB = {
      ...bedtimeSave("pet-five"),
      revision: 1,
      bond: {
        total: 50,
        earnedToday: 0,
        earnedDate: localDate,
      },
      sleepingUntil: null,
    };
    authState.user = { uid: "late-reader" };
    storageMocks.readCottageCache.mockReturnValue(accountB);
    storageMocks.loadCottageCloud.mockReturnValue(accountBLoad);
    await act(async () => {
      root.render(<CloudCottage onExit={vi.fn()} />);
      await Promise.resolve();
    });
    expect(gameState().sync).toBe("cache");
    expect(gameState().pet.bond.total).toBe(50);

    await act(async () => {
      resolveQueuedWake(queuedWakeSave);
      await Promise.resolve();
    });
    await flushAsyncWork();
    expect(gameState().sync).toBe("cache");
    expect(gameState().pet.bond.total).toBe(50);

    await act(async () => {
      resolveAccountB(accountB);
      await accountBLoad;
    });
    await flushAsyncWork();

    expect(storageMocks.writeCottageCache).toHaveBeenCalledWith(
      "late-reader",
      expect.objectContaining({
        bond: expect.objectContaining({ total: 50 }),
      }),
    );
    expect(gameState().sync).toBe("cloud");
    expect(gameState().pet.bond.total).toBe(50);
    expect(gameState().pet.sleeping).toBe(false);
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
