import { describe, expect, it } from "vitest";
import { PURCHASABLE_OUTFITS } from "../data/outfits";
import {
  FLOORS,
  FURNITURE,
  PURCHASABLE_FLOORS,
  PURCHASABLE_FURNITURE,
  PURCHASABLE_WALLPAPERS,
  WALLPAPERS,
} from "../data/furniture";
import type { PetSaveV1 } from "../types";
import { createInitialPetSave, petPet } from "./petState";
import {
  addPlacedFurniture,
  applyPersonalizationAction,
  backfillEarnedBondGifts,
  BOND_GIFTS,
  equipOutfit,
  getNewlyGrantedBondGifts,
  grantEarnedBondGifts,
  movePlacedFurniture,
  normalizePercentage,
  removePlacedFurniture,
  selectFloor,
  selectWallpaper,
  unequipOutfit,
} from "./personalization";

const NOW = new Date(2026, 6, 30, 12).getTime();
const DATE = "2026-07-30";

function stockedSave(): PetSaveV1 {
  const initial = createInitialPetSave(NOW, DATE);
  return {
    ...initial,
    inventory: {
      ...initial.inventory,
      outfits: ["strawberry-clip", "sailor-hat", "red-ribbon"],
      furniture: [...initial.inventory.furniture, "lamp", "picture"],
      wallpapers: [...initial.inventory.wallpapers, "starry-night"],
      floors: [...initial.inventory.floors, "cloud-carpet"],
    },
  };
}

describe("Phase 2 catalogs", () => {
  it("keeps exact outfit prices and head/neck slots", () => {
    expect(
      PURCHASABLE_OUTFITS.map(({ id, price, slot }) => ({ id, price, slot })),
    ).toEqual([
      { id: "strawberry-clip", price: 120, slot: "head" },
      { id: "sailor-hat", price: 150, slot: "head" },
      { id: "flower-crown", price: 180, slot: "head" },
      { id: "star-headband", price: 200, slot: "head" },
      { id: "red-ribbon", price: 120, slot: "neck" },
      { id: "blue-scarf", price: 150, slot: "neck" },
      { id: "bell-collar", price: 180, slot: "neck" },
      { id: "rainbow-scarf", price: 220, slot: "neck" },
    ]);
  });

  it("keeps exact decor prices and canonical wall/floor zones", () => {
    expect(
      PURCHASABLE_FURNITURE.map(({ id, price, zone }) => ({ id, price, zone })),
    ).toEqual([
      { id: "lamp", price: 80, zone: "floor" },
      { id: "plant", price: 80, zone: "floor" },
      { id: "picture", price: 100, zone: "wall" },
      { id: "rug", price: 100, zone: "floor" },
      { id: "table", price: 120, zone: "floor" },
      { id: "curtain", price: 120, zone: "wall" },
      { id: "sofa", price: 150, zone: "floor" },
      { id: "bookshelf", price: 150, zone: "floor" },
    ]);
    expect(PURCHASABLE_WALLPAPERS.map(({ id, price }) => ({ id, price }))).toEqual([
      { id: "starry-night", price: 200 },
      { id: "candy-stripes", price: 200 },
      { id: "forest", price: 200 },
    ]);
    expect(PURCHASABLE_FLOORS.map(({ id, price }) => ({ id, price }))).toEqual([
      { id: "cloud-carpet", price: 200 },
      { id: "frosting-check", price: 200 },
    ]);
  });

  it("marks the default room items and all six gifts as free, non-shop items", () => {
    expect(FURNITURE.find((item) => item.id === "cloud-bed")).toMatchObject({
      price: 0,
      source: "default",
      zone: "floor",
    });
    expect(WALLPAPERS.find((item) => item.id === "cloud-blue")).toMatchObject({
      price: 0,
      source: "default",
    });
    expect(FLOORS.find((item) => item.id === "cream-wood")).toMatchObject({
      price: 0,
      source: "default",
    });
    expect(BOND_GIFTS.map((gift) => gift.level)).toEqual([5, 8, 11, 14, 15, 18]);
  });
});

describe("outfit and surface selection", () => {
  it("equips into the catalog slot and replaces only that slot", () => {
    const initial = stockedSave();
    const first = equipOutfit(initial, "strawberry-clip", NOW + 1);
    expect(first.applied).toBe(true);
    expect(first.save.equipped).toEqual({ head: "strawberry-clip" });
    expect(initial.equipped).toEqual({});

    const neck = equipOutfit(first.save, "red-ribbon", NOW + 2);
    const replacement = equipOutfit(neck.save, "sailor-hat", NOW + 3);
    expect(replacement.save.equipped).toEqual({
      head: "sailor-hat",
      neck: "red-ribbon",
    });
  });

  it("rejects unowned outfits and deterministically unequips a slot", () => {
    const initial = stockedSave();
    expect(equipOutfit(initial, "flower-crown", NOW + 1)).toMatchObject({
      applied: false,
      reason: "not-owned",
      save: initial,
    });
    const equipped = equipOutfit(initial, "red-ribbon", NOW + 1);
    const removed = unequipOutfit(equipped.save, "neck", NOW + 2);
    expect(removed.applied).toBe(true);
    expect(removed.save.equipped.neck).toBeUndefined();
    expect(unequipOutfit(removed.save, "neck", NOW + 3)).toMatchObject({
      applied: false,
      reason: "not-equipped",
    });
  });

  it("selects only owned wallpaper and flooring", () => {
    const initial = stockedSave();
    expect(selectWallpaper(initial, "forest", NOW + 1)).toMatchObject({
      applied: false,
      reason: "not-owned",
    });
    const wallpaper = selectWallpaper(initial, "starry-night", NOW + 1);
    const floor = selectFloor(wallpaper.save, "cloud-carpet", NOW + 2);
    expect(floor.save.room).toMatchObject({
      wallpaperId: "starry-night",
      floorId: "cloud-carpet",
    });
  });
});

describe("freeform furniture placement", () => {
  it("normalizes percentage coordinates and preserves the catalog zone", () => {
    expect(normalizePercentage(-9)).toBe(0);
    expect(normalizePercentage(101)).toBe(100);
    expect(normalizePercentage(12.345)).toBe(12.35);
    expect(normalizePercentage(Number.NaN)).toBeNull();

    const initial = stockedSave();
    const added = addPlacedFurniture(
      initial,
      "lamp",
      -10,
      120,
      "floor",
      NOW + 1,
    );
    expect(added.applied).toBe(true);
    expect(added.save.room.placed.at(-1)).toEqual({
      id: "lamp",
      x: 0,
      y: 100,
      zone: "floor",
    });
    expect(initial.room.placed).toHaveLength(1);
  });

  it("validates inventory, zone, finite positions, and duplicate placement", () => {
    const initial = stockedSave();
    expect(addPlacedFurniture(initial, "sofa", 20, 20, "floor", NOW)).toMatchObject({
      applied: false,
      reason: "not-owned",
    });
    expect(addPlacedFurniture(initial, "picture", 20, 20, "floor", NOW)).toMatchObject({
      applied: false,
      reason: "wrong-zone",
    });
    expect(addPlacedFurniture(initial, "lamp", Number.NaN, 20, "floor", NOW)).toMatchObject({
      applied: false,
      reason: "invalid-position",
    });
    expect(addPlacedFurniture(initial, "cloud-bed", 10, 10, "floor", NOW)).toMatchObject({
      applied: false,
      reason: "already-placed",
    });
  });

  it("moves and removes one owned instance deterministically", () => {
    const initial = stockedSave();
    const added = addPlacedFurniture(initial, "lamp", 10, 20, undefined, NOW + 1);
    const moved = movePlacedFurniture(added.save, "lamp", 55.555, 66.666, undefined, NOW + 2);
    expect(moved.save.room.placed).toEqual([
      initial.room.placed[0],
      { id: "lamp", x: 55.56, y: 66.67, zone: "floor" },
    ]);
    const removed = removePlacedFurniture(moved.save, "lamp", NOW + 3);
    expect(removed.save.room.placed).toEqual(initial.room.placed);
    expect(removePlacedFurniture(removed.save, "lamp", NOW + 4)).toMatchObject({
      applied: false,
      reason: "not-placed",
    });
  });

  it("routes serializable actions through one canonical dispatcher", () => {
    const initial = stockedSave();
    const result = applyPersonalizationAction(
      initial,
      { type: "add-furniture", furnitureId: "picture", x: 20, y: 30, zone: "wall" },
      NOW + 1,
    );
    expect(result.applied).toBe(true);
    expect(result.save.room.placed.at(-1)).toMatchObject({
      id: "picture",
      zone: "wall",
    });
  });
});

describe("retroactive bond gifts", () => {
  it("grants every earned gift by level without placing or equipping it", () => {
    const initial = createInitialPetSave(NOW, DATE);
    const highBond = {
      ...initial,
      bond: { ...initial.bond, total: 2_090 },
    };
    const result = grantEarnedBondGifts(highBond, NOW + 1);

    expect(result.granted.map((gift) => gift.id)).toEqual([
      "flower-gift",
      "clover-plant",
      "star-hanging",
      "rainbow-picture",
      "golden-bow",
      "cloud-frame",
    ]);
    expect(result.save.inventory.furniture).toEqual([
      "cloud-bed",
      "flower-gift",
      "clover-plant",
      "star-hanging",
      "rainbow-picture",
      "cloud-frame",
    ]);
    expect(result.save.inventory.outfits).toEqual(["golden-bow"]);
    expect(result.save.room.placed).toEqual(initial.room.placed);
    expect(result.save.equipped).toEqual({});
  });

  it("is idempotent and returns the same save when no gift is missing", () => {
    const initial = createInitialPetSave(NOW, DATE);
    const highBond = { ...initial, bond: { ...initial.bond, total: 2_090 } };
    const first = grantEarnedBondGifts(highBond, NOW + 1);
    const second = grantEarnedBondGifts(first.save, NOW + 2);
    expect(second.granted).toEqual([]);
    expect(second.save).toBe(first.save);
    expect(second.save.revision).toBe(1);
  });

  it.each([
    [140, "flower-gift"],
    [350, "clover-plant"],
    [650, "star-hanging"],
    [1_040, "rainbow-picture"],
    [1_190, "golden-bow"],
    [1_700, "cloud-frame"],
  ] as const)("grants %s-threshold gift %s exactly at its bond boundary", (threshold, giftId) => {
    const initial = createInitialPetSave(NOW, DATE);
    const before = grantEarnedBondGifts(
      { ...initial, bond: { ...initial.bond, total: threshold - 1 } },
      NOW + 1,
    );
    expect(before.granted.map((gift) => gift.id)).not.toContain(giftId);

    const atThreshold = grantEarnedBondGifts(
      { ...initial, bond: { ...initial.bond, total: threshold } },
      NOW + 1,
    );
    expect(atThreshold.granted.map((gift) => gift.id)).toContain(giftId);
  });

  it("backfills the L5 gift in the same transition that crosses its threshold", () => {
    const initial = createInitialPetSave(NOW, DATE);
    const nearlyLevelFive = {
      ...initial,
      bond: { ...initial.bond, total: 138 },
    };
    const result = petPet(nearlyLevelFive, NOW + 1, DATE);
    expect(result.save.bond.total).toBe(140);
    expect(result.save.inventory.furniture).toContain("flower-gift");
    expect(result.grantedGifts).toEqual([
      { level: 5, kind: "furniture", id: "flower-gift" },
    ]);
    expect(getNewlyGrantedBondGifts(nearlyLevelFive, result.save)).toEqual([
      { level: 5, kind: "furniture", id: "flower-gift" },
    ]);
  });

  it("offers a metadata-neutral backfill for normalization", () => {
    const initial = createInitialPetSave(NOW, DATE);
    const eligible = { ...initial, bond: { ...initial.bond, total: 1_190 } };
    const result = backfillEarnedBondGifts(eligible);
    expect(result.save.revision).toBe(eligible.revision);
    expect(result.save.inventory.outfits).toContain("golden-bow");
  });

  it("grants legacy gifts and applies personalization in one touched revision", () => {
    const initial = createInitialPetSave(NOW, DATE);
    const eligible = { ...initial, bond: { ...initial.bond, total: 1_190 } };
    const result = equipOutfit(eligible, "golden-bow", NOW + 1);
    expect(result.applied).toBe(true);
    expect(result.save.revision).toBe(eligible.revision + 1);
    expect(result.save.equipped.head).toBe("golden-bow");
    expect(result.grantedGifts.map((gift) => gift.id)).toEqual([
      "flower-gift",
      "clover-plant",
      "star-hanging",
      "rainbow-picture",
      "golden-bow",
    ]);
  });
});
