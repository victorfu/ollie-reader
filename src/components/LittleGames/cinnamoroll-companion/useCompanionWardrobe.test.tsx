import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionWardrobe } from "../../../types/companion";

const auth = vi.hoisted(() => ({ user: null as { uid: string } | null }));
const storage = vi.hoisted(() => ({
  purchaseCompanionAccessory: vi.fn(),
  saveCompanionEquipment: vi.fn(),
  subscribeCompanionWardrobe: vi.fn(),
  onWardrobe: null as ((wardrobe: CompanionWardrobe) => void) | null,
}));
const balance = vi.hoisted(() => ({ onBalance: null as ((value: number) => void) | null }));

vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../../../services/gameProgressService", () => ({
  subscribeTokenBalance: (_uid: string, onBalance: (value: number) => void) => {
    balance.onBalance = onBalance;
    return () => undefined;
  },
}));
vi.mock("./companionWardrobeStorage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./companionWardrobeStorage")>()),
  purchaseCompanionAccessory: storage.purchaseCompanionAccessory,
  saveCompanionEquipment: storage.saveCompanionEquipment,
  subscribeCompanionWardrobe: storage.subscribeCompanionWardrobe,
}));

import { CompanionAlreadyOwnedError, CompanionInsufficientCoinsError } from "./companionWardrobeStorage";
import { useCompanionWardrobe, type CompanionWardrobeState } from "./useCompanionWardrobe";

let container: HTMLDivElement;
let root: Root;
let state: CompanionWardrobeState;

function Probe({ onState }: { onState: (value: CompanionWardrobeState) => void }) {
  onState(useCompanionWardrobe());
  return null;
}

async function render() {
  await act(async () => root.render(<Probe onState={(value) => { state = value; }} />));
}

async function signInReady(owned: string[] = [], coins = 500) {
  auth.user = { uid: "uid-1" };
  await render();
  act(() => {
    storage.onWardrobe?.({ owned: new Set(owned) as CompanionWardrobe["owned"], equipped: {} });
    balance.onBalance?.(coins);
  });
}

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  auth.user = null;
  storage.onWardrobe = null;
  balance.onBalance = null;
  storage.subscribeCompanionWardrobe.mockImplementation(async (_uid: string, onWardrobe: (w: CompanionWardrobe) => void) => {
    storage.onWardrobe = onWardrobe;
    return () => undefined;
  });
  storage.saveCompanionEquipment.mockResolvedValue(undefined);
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  storage.purchaseCompanionAccessory.mockReset();
  storage.saveCompanionEquipment.mockReset();
});

describe("useCompanionWardrobe", () => {
  it("lets a guest look but never buy or save", async () => {
    await render();

    expect(state.status).toBe("guest");
    expect(state.balance).toBeNull();
    let outcome = "";
    await act(async () => { outcome = await state.purchase("bow"); });
    act(() => state.equip({ head: "bow" }));

    expect(outcome).toBe("failed");
    expect(storage.subscribeCompanionWardrobe).not.toHaveBeenCalled();
    expect(storage.purchaseCompanionAccessory).not.toHaveBeenCalled();
    expect(storage.saveCompanionEquipment).not.toHaveBeenCalled();
  });

  it("loads the signed-in wardrobe and balance before buying is possible", async () => {
    auth.user = { uid: "uid-1" };
    await render();
    expect(state.status).toBe("loading");
    let outcome = "";
    await act(async () => { outcome = await state.purchase("bow"); });
    expect(outcome).toBe("failed");
    expect(storage.purchaseCompanionAccessory).not.toHaveBeenCalled();

    act(() => {
      storage.onWardrobe?.({ owned: new Set(["scarf"]), equipped: { neck: "scarf" } });
      balance.onBalance?.(120);
    });
    expect(state.status).toBe("ready");
    expect(state.balance).toBe(120);
    expect([...state.wardrobe.owned]).toEqual(["scarf"]);
  });

  it("ignores a double tap while the first purchase is in flight", async () => {
    await signInReady();
    let finish!: () => void;
    storage.purchaseCompanionAccessory.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));

    let first!: Promise<string>;
    let second = "";
    await act(async () => {
      first = state.purchase("bow");
      second = await state.purchase("bow");
    });
    expect(second).toBe("busy");
    expect(state.buying).toBe("bow");

    await act(async () => { finish(); await first; });
    expect(await first).toBe("bought");
    expect(storage.purchaseCompanionAccessory).toHaveBeenCalledTimes(1);
    expect(state.buying).toBeNull();
  });

  it("retries an uncertain failure with the same purchase id so it cannot charge twice", async () => {
    await signInReady();
    storage.purchaseCompanionAccessory
      .mockRejectedValueOnce(new Error("deadline-exceeded"))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const outcomes: string[] = [];
    await act(async () => { outcomes.push(await state.purchase("hat")); });
    await act(async () => { outcomes.push(await state.purchase("hat")); });
    await act(async () => { outcomes.push(await state.purchase("hat")); });

    expect(outcomes).toEqual(["failed", "bought", "bought"]);
    const ids = storage.purchaseCompanionAccessory.mock.calls.map((call) => call[2]);
    expect(ids[0]).toBe(ids[1]);
    // A finished purchase starts fresh next time.
    expect(ids[2]).not.toBe(ids[1]);
  });

  it("reports short balances and already-owned items as no charge", async () => {
    await signInReady([], 10);
    storage.purchaseCompanionAccessory
      .mockRejectedValueOnce(new CompanionInsufficientCoinsError(50, 10))
      .mockRejectedValueOnce(new CompanionAlreadyOwnedError("bow"));

    const outcomes: string[] = [];
    await act(async () => { outcomes.push(await state.purchase("bow")); });
    await act(async () => { outcomes.push(await state.purchase("bow")); });

    expect(outcomes).toEqual(["insufficient", "owned"]);
  });

  it("does not try to buy while offline", async () => {
    await signInReady();
    setOnline(false);

    let outcome = "";
    await act(async () => { outcome = await state.purchase("bow"); });

    expect(outcome).toBe("offline");
    expect(storage.purchaseCompanionAccessory).not.toHaveBeenCalled();
  });

  it("saves equipment only once something is owned", async () => {
    await signInReady();
    act(() => state.equip({ head: "bow" }));
    expect(storage.saveCompanionEquipment).not.toHaveBeenCalled();

    act(() => storage.onWardrobe?.({ owned: new Set(["bow"]), equipped: {} }));
    act(() => state.equip({ head: "bow" }));
    expect(storage.saveCompanionEquipment).toHaveBeenCalledWith("uid-1", { head: "bow" }, new Set(["bow"]));
  });

  it("never shows one account's wardrobe under another", async () => {
    await signInReady(["crown"], 900);
    auth.user = { uid: "uid-2" };
    await render();

    expect(state.status).toBe("loading");
    expect(state.wardrobe.owned.size).toBe(0);
    expect(state.balance).toBeNull();
  });
});
