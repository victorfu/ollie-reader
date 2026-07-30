import { describe, expect, it } from "vitest";
import { createInitialPetSave } from "./petState";
import {
  applyPurchase,
  COTTAGE_PRODUCTS,
  consumeSnack,
  getProduct,
  isCottageProductId,
} from "./purchases";

const NOW = new Date(2026, 6, 30, 12).getTime();

describe("applyPurchase", () => {
  it("uses the canonical catalog price and adds a snack", () => {
    const initial = createInitialPetSave(NOW, "2026-07-30");
    const result = applyPurchase(initial, 100, "cloud-cake", NOW + 1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getProduct("cloud-cake")?.price).toBe(40);
    expect(result.coinsAfter).toBe(60);
    expect(result.save.inventory.snacks["cloud-cake"]).toBe(1);
    expect(initial.inventory.snacks["cloud-cake"]).toBeUndefined();
  });

  it("does not mutate either balance or save when coins are insufficient", () => {
    const initial = createInitialPetSave(NOW, "2026-07-30");
    const result = applyPurchase(initial, 39, "cloud-cake", NOW + 1);

    expect(result).toMatchObject({
      ok: false,
      reason: "insufficient-coins",
      coinsAfter: 39,
      save: initial,
    });
  });

  it("prevents a permanent toy from being purchased twice", () => {
    const initial = createInitialPetSave(NOW, "2026-07-30");
    const first = applyPurchase(initial, 200, "ball", NOW + 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const duplicate = applyPurchase(first.save, first.coinsAfter, "ball", NOW + 2);
    expect(duplicate).toMatchObject({
      ok: false,
      reason: "already-owned",
      coinsAfter: 140,
      save: first.save,
    });
  });

  it.each([
    ["strawberry-clip", "outfits", 120],
    ["lamp", "furniture", 80],
    ["starry-night", "wallpapers", 200],
    ["cloud-carpet", "floors", 200],
  ] as const)("adds permanent %s purchases to canonical %s inventory", (productId, inventoryKey, price) => {
    const initial = createInitialPetSave(NOW, "2026-07-30");
    const result = applyPurchase(initial, 500, productId, NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coinsAfter).toBe(500 - price);
    expect(result.save.inventory[inventoryKey]).toContain(productId);

    const duplicate = applyPurchase(result.save, result.coinsAfter, productId, NOW + 2);
    expect(duplicate).toMatchObject({
      ok: false,
      reason: "already-owned",
      coinsAfter: 500 - price,
      save: result.save,
    });
  });

  it("exposes every paid catalog entry but never sells defaults or bond gifts", () => {
    expect(COTTAGE_PRODUCTS).toHaveLength(34);
    expect(COTTAGE_PRODUCTS.filter((product) => product.kind !== "snack")).toHaveLength(26);
    expect(getProduct("golden-bow")).toBeUndefined();
    expect(getProduct("cloud-bed")).toBeUndefined();
    expect(getProduct("cloud-blue")).toBeUndefined();
    expect(getProduct("cream-wood")).toBeUndefined();
    expect(isCottageProductId("flower-crown")).toBe(true);
    expect(isCottageProductId("golden-bow")).toBe(false);
  });
});

describe("consumeSnack", () => {
  it("immutably decrements canonical snack inventory and removes zero entries", () => {
    const initial = createInitialPetSave(NOW, "2026-07-30");
    const stocked = {
      ...initial,
      inventory: {
        ...initial.inventory,
        snacks: { apple: 1 },
      },
    };

    const result = consumeSnack(stocked, "apple", NOW + 1);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.save.inventory.snacks.apple).toBeUndefined();
    expect(stocked.inventory.snacks.apple).toBe(1);
  });

  it("rejects empty and unknown snacks without changing the save", () => {
    const initial = createInitialPetSave(NOW, "2026-07-30");
    expect(consumeSnack(initial, "apple", NOW + 1)).toMatchObject({
      ok: false,
      reason: "out-of-stock",
      save: initial,
    });
    expect(consumeSnack(initial, "not-a-snack", NOW + 1)).toMatchObject({
      ok: false,
      reason: "invalid-snack",
      save: initial,
    });
  });
});
