import { SNACKS, isSnackId } from "../data/foods";
import { TOYS } from "../data/toys";
import { PURCHASABLE_OUTFITS } from "../data/outfits";
import {
  PURCHASABLE_FLOORS,
  PURCHASABLE_FURNITURE,
  PURCHASABLE_WALLPAPERS,
} from "../data/furniture";
import type {
  CottageProduct,
  CottageProductId,
  PetSaveV1,
  SnackId,
} from "../types";

export const COTTAGE_PRODUCTS: readonly CottageProduct[] = [
  ...SNACKS.map((snack) => ({
    kind: "snack" as const,
    id: snack.id as SnackId,
    nameZh: snack.nameZh,
    nameEn: snack.nameEn,
    price: snack.price,
  })),
  ...TOYS.map((toy) => ({
    kind: "toy" as const,
    id: toy.id,
    nameZh: toy.nameZh,
    nameEn: toy.nameEn,
    price: toy.price,
  })),
  ...PURCHASABLE_OUTFITS.map((outfit) => ({
    kind: "outfit" as const,
    id: outfit.id,
    nameZh: outfit.nameZh,
    nameEn: outfit.nameEn,
    price: outfit.price,
    slot: outfit.slot,
  })),
  ...PURCHASABLE_FURNITURE.map((item) => ({
    kind: "furniture" as const,
    id: item.id,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    price: item.price,
    zone: item.zone,
  })),
  ...PURCHASABLE_WALLPAPERS.map((item) => ({
    kind: "wallpaper" as const,
    id: item.id,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    price: item.price,
  })),
  ...PURCHASABLE_FLOORS.map((item) => ({
    kind: "floor" as const,
    id: item.id,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    price: item.price,
  })),
];

const PRODUCT_BY_ID = new Map<CottageProductId, CottageProduct>(
  COTTAGE_PRODUCTS.map((product) => [product.id, product]),
);

export function getProduct(
  productId: CottageProductId | string,
): CottageProduct | undefined {
  return PRODUCT_BY_ID.get(productId as CottageProductId);
}

function touch(save: PetSaveV1, now: number): PetSaveV1 {
  return {
    ...save,
    revision: Math.max(0, Math.floor(save.revision)) + 1,
    clientUpdatedAt: now,
  };
}

export type PurchaseResult =
  | {
      ok: true;
      save: PetSaveV1;
      coinsAfter: number;
      product: CottageProduct;
    }
  | {
      ok: false;
      save: PetSaveV1;
      coinsAfter: number;
      reason: "invalid-product" | "invalid-balance" | "insufficient-coins" | "already-owned";
      product?: CottageProduct;
    };

export function isPermanentProduct(product: CottageProduct): boolean {
  return product.kind !== "snack";
}

export function ownsProduct(save: PetSaveV1, product: CottageProduct): boolean {
  switch (product.kind) {
    case "snack":
      return false;
    case "toy":
      return save.inventory.toys.includes(product.id);
    case "outfit":
      return save.inventory.outfits.includes(product.id);
    case "furniture":
      return save.inventory.furniture.includes(product.id);
    case "wallpaper":
      return save.inventory.wallpapers.includes(product.id);
    case "floor":
      return save.inventory.floors.includes(product.id);
  }
}

/** Canonical catalog price is always used; callers cannot supply a price. */
export function applyPurchase(
  save: PetSaveV1,
  coins: number,
  productId: CottageProductId | string,
  now: number = Date.now(),
): PurchaseResult {
  const product = getProduct(productId);
  if (!product) {
    return { ok: false, save, coinsAfter: coins, reason: "invalid-product" };
  }
  if (!Number.isSafeInteger(coins) || coins < 0) {
    return { ok: false, save, coinsAfter: coins, reason: "invalid-balance", product };
  }
  if (isPermanentProduct(product) && ownsProduct(save, product)) {
    return { ok: false, save, coinsAfter: coins, reason: "already-owned", product };
  }
  if (coins < product.price) {
    return { ok: false, save, coinsAfter: coins, reason: "insufficient-coins", product };
  }

  let inventory: PetSaveV1["inventory"];
  switch (product.kind) {
    case "snack":
      inventory = {
        ...save.inventory,
        snacks: {
          ...save.inventory.snacks,
          [product.id]: (save.inventory.snacks[product.id] ?? 0) + 1,
        },
      };
      break;
    case "toy":
      inventory = {
        ...save.inventory,
        toys: [...save.inventory.toys, product.id],
      };
      break;
    case "outfit":
      inventory = {
        ...save.inventory,
        outfits: [...save.inventory.outfits, product.id],
      };
      break;
    case "furniture":
      inventory = {
        ...save.inventory,
        furniture: [...save.inventory.furniture, product.id],
      };
      break;
    case "wallpaper":
      inventory = {
        ...save.inventory,
        wallpapers: [...save.inventory.wallpapers, product.id],
      };
      break;
    case "floor":
      inventory = {
        ...save.inventory,
        floors: [...save.inventory.floors, product.id],
      };
      break;
  }
  const nextSave = touch({ ...save, inventory }, now);
  return {
    ok: true,
    save: nextSave,
    coinsAfter: coins - product.price,
    product,
  };
}

export type ConsumeSnackResult =
  | { ok: true; save: PetSaveV1; remaining: number }
  | {
      ok: false;
      save: PetSaveV1;
      remaining: number;
      reason: "invalid-snack" | "out-of-stock";
    };

/** Transaction-safe, immutable paid-snack decrement. */
export function consumeSnack(
  save: PetSaveV1,
  snackId: SnackId | string,
  now: number = Date.now(),
): ConsumeSnackResult {
  if (!isSnackId(snackId)) {
    return { ok: false, save, remaining: 0, reason: "invalid-snack" };
  }
  const current = Math.max(0, Math.floor(save.inventory.snacks[snackId] ?? 0));
  if (current === 0) {
    return { ok: false, save, remaining: 0, reason: "out-of-stock" };
  }

  const remaining = current - 1;
  const snacks = { ...save.inventory.snacks };
  if (remaining === 0) delete snacks[snackId];
  else snacks[snackId] = remaining;
  return {
    ok: true,
    save: touch(
      { ...save, inventory: { ...save.inventory, snacks } },
      now,
    ),
    remaining,
  };
}

export function isCottageProductId(value: unknown): value is CottageProductId {
  return typeof value === "string" && getProduct(value) !== undefined;
}
