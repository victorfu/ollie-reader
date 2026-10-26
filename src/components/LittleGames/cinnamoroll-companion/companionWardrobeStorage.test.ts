import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({ kind: "mock-firestore" }));

vi.mock("firebase/firestore", () => firestoreMocks);
vi.mock("../../../utils/firebaseUtil", () => ({ db: mockDb }));

import {
  COMPANION_WARDROBE_DOC,
  CompanionAlreadyOwnedError,
  CompanionInsufficientCoinsError,
  isCompanionAlreadyOwnedError,
  isCompanionInsufficientCoinsError,
  normalizeWardrobe,
  purchaseCompanionAccessory,
  saveCompanionEquipment,
  subscribeCompanionWardrobe,
} from "./companionWardrobeStorage";
import { COMPANION_PRICES } from "./logic/outfit";

const wardrobeRef = { kind: "wardrobe-document" };
const progressRef = { kind: "progress-document" };
const serverTimestamp = { kind: "server-timestamp" };

function snapshot(data: unknown | null) {
  return { exists: () => data !== null, data: () => data };
}

// 購買交易會讀兩個文件：大耳狗背包子文件 + 玩家進度（代幣）文件
function transactionFor(wardrobe: unknown | null, progress: unknown | null = { coins: 500 }) {
  return {
    get: vi.fn().mockImplementation((ref: unknown) =>
      Promise.resolve(ref === progressRef ? snapshot(progress) : snapshot(wardrobe))),
    set: vi.fn(),
    update: vi.fn(),
  };
}

function runWith(transaction: ReturnType<typeof transactionFor>) {
  firestoreMocks.runTransaction.mockImplementation(
    async (_db: unknown, update: (tx: typeof transaction) => unknown) => update(transaction),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  firestoreMocks.doc.mockImplementation((_db: unknown, ...path: string[]) =>
    path.length === 2 ? progressRef : wardrobeRef);
  firestoreMocks.serverTimestamp.mockReturnValue(serverTimestamp);
});

describe("purchaseCompanionAccessory", () => {
  it("charges the catalog price, grants and puts the item on in one transaction", async () => {
    const tx = transactionFor(null, { coins: 130 });
    runWith(tx);

    const result = await purchaseCompanionAccessory("uid-1", "hat", "purchase-1");

    expect(firestoreMocks.doc).toHaveBeenCalledWith(mockDb, "gameProgress", "uid-1", "littleGames", COMPANION_WARDROBE_DOC);
    expect(firestoreMocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(tx.set).toHaveBeenCalledWith(wardrobeRef, {
      schemaVersion: 1,
      owned: { hat: { price: COMPANION_PRICES.hat, purchaseId: "purchase-1", purchasedAt: serverTimestamp } },
      equipped: { head: "hat" },
      updatedAt: serverTimestamp,
      createdAt: serverTimestamp,
    }, { merge: true });
    expect(tx.update).toHaveBeenCalledWith(progressRef, { coins: 130 - COMPANION_PRICES.hat, updatedAt: serverTimestamp });
    expect(result).toEqual({ wardrobe: { owned: new Set(["hat"]), equipped: { head: "hat" } }, coinsAfter: 30, replayed: false });
  });

  it("keeps earlier purchases and replaces only the bought item's slot", async () => {
    const tx = transactionFor({
      owned: { bow: { purchaseId: "old" }, scarf: { purchaseId: "older" } },
      equipped: { head: "bow", neck: "scarf" },
      createdAt: "earlier",
    }, { coins: 300 });
    runWith(tx);

    const result = await purchaseCompanionAccessory("uid-1", "crown", "purchase-2");

    const written = tx.set.mock.calls[0][1];
    expect(written.owned).toEqual({ crown: { price: 300, purchaseId: "purchase-2", purchasedAt: serverTimestamp } });
    expect(written.equipped).toEqual({ head: "crown", neck: "scarf" });
    expect(written).not.toHaveProperty("createdAt");
    expect(tx.update).toHaveBeenCalledWith(progressRef, { coins: 0, updatedAt: serverTimestamp });
    expect([...result.wardrobe.owned].sort()).toEqual(["bow", "crown", "scarf"]);
  });

  it("refuses without charging when the balance is short or there is no progress save", async () => {
    for (const progress of [{ coins: 49 }, null, { coins: -100 }, { coins: "999" }]) {
      const tx = transactionFor(null, progress);
      runWith(tx);
      const error = await purchaseCompanionAccessory("uid-1", "bow", "purchase-1").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(CompanionInsufficientCoinsError);
      expect(isCompanionInsufficientCoinsError(error)).toBe(true);
      expect(tx.set).not.toHaveBeenCalled();
      expect(tx.update).not.toHaveBeenCalled();
    }
  });

  it("refuses a second purchase of an owned item, e.g. from another tab, without charging", async () => {
    const tx = transactionFor({ owned: { bow: { purchaseId: "other-tab" } }, equipped: {} });
    runWith(tx);

    const error = await purchaseCompanionAccessory("uid-1", "bow", "this-tab").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CompanionAlreadyOwnedError);
    expect(isCompanionAlreadyOwnedError({ code: "COMPANION_ALREADY_OWNED" })).toBe(true);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("returns the earlier result when a retry reuses a purchase id that already went through", async () => {
    const tx = transactionFor({ owned: { bow: { purchaseId: "purchase-1" } }, equipped: { head: "bow" } }, { coins: 450 });
    runWith(tx);

    const result = await purchaseCompanionAccessory("uid-1", "bow", "purchase-1");

    expect(result).toEqual({ wardrobe: { owned: new Set(["bow"]), equipped: { head: "bow" } }, coinsAfter: 450, replayed: true });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("rejects unknown items, a missing user and an empty purchase id before touching Firestore", async () => {
    await expect(purchaseCompanionAccessory("uid-1", "cape" as never, "p")).rejects.toThrow("Unknown");
    await expect(purchaseCompanionAccessory(" ", "bow", "p")).rejects.toThrow("signed-in");
    await expect(purchaseCompanionAccessory("uid-1", "bow", "")).rejects.toThrow("purchase id");
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });

  it("propagates a failed transaction without claiming a purchase", async () => {
    firestoreMocks.runTransaction.mockRejectedValue(new Error("unavailable"));
    await expect(purchaseCompanionAccessory("uid-1", "bow", "p")).rejects.toThrow("unavailable");
  });
});

describe("normalizeWardrobe", () => {
  it("drops unknown items and equipment that is unowned or in the wrong slot", () => {
    expect(normalizeWardrobe({
      owned: { bow: {}, scarf: {}, cape: {} },
      equipped: { head: "bow", face: "scarf", neck: "crown", hand: "cape" },
    })).toEqual({ owned: new Set(["bow", "scarf"]), equipped: { head: "bow" } });
    expect(normalizeWardrobe(null)).toEqual({ owned: new Set(), equipped: {} });
    expect(normalizeWardrobe({ owned: ["bow"], equipped: "bow" })).toEqual({ owned: new Set(), equipped: {} });
  });
});

describe("saveCompanionEquipment", () => {
  it("saves only owned items in their slots", async () => {
    firestoreMocks.updateDoc.mockResolvedValue(undefined);

    await saveCompanionEquipment("uid-1", { head: "crown", neck: "scarf", face: "bow" }, new Set(["scarf", "bow"]));

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(wardrobeRef, { equipped: { neck: "scarf" }, updatedAt: serverTimestamp });
  });
});

describe("subscribeCompanionWardrobe", () => {
  it("reports an empty wardrobe until something is bought", async () => {
    const onWardrobe = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_ref: unknown, next: (snap: unknown) => void) => {
      next(snapshot(null));
      next(snapshot({ owned: { plush: {} }, equipped: { hand: "plush" } }));
      return () => undefined;
    });

    await subscribeCompanionWardrobe("uid-1", onWardrobe, vi.fn());

    expect(onWardrobe.mock.calls).toEqual([
      [{ owned: new Set(), equipped: {} }],
      [{ owned: new Set(["plush"]), equipped: { hand: "plush" } }],
    ]);
  });
});
