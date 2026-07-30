import { getBondLevel } from "./bond";
import { getOutfit } from "../data/outfits";
import {
  getFloor,
  getFurniture,
  getWallpaper,
} from "../data/furniture";
import type {
  FloorId,
  FurnitureId,
  FurnitureZone,
  OutfitId,
  OutfitSlot,
  PetSaveV1,
  PlacedFurniture,
  WallpaperId,
} from "../types";

export type PersonalizationFailureReason =
  | "invalid-item"
  | "not-owned"
  | "already-equipped"
  | "not-equipped"
  | "already-selected"
  | "already-placed"
  | "not-placed"
  | "wrong-zone"
  | "invalid-position"
  | "no-change";

export type PersonalizationResult = {
  save: PetSaveV1;
  applied: boolean;
  reason?: PersonalizationFailureReason;
  grantedGifts: BondGift[];
};

export type PersonalizationAction =
  | { type: "equip-outfit"; outfitId: OutfitId }
  | { type: "unequip-outfit"; slot: OutfitSlot }
  | { type: "select-wallpaper"; wallpaperId: WallpaperId }
  | { type: "select-floor"; floorId: FloorId }
  | {
      type: "add-furniture";
      furnitureId: FurnitureId;
      x: number;
      y: number;
      zone?: FurnitureZone;
    }
  | {
      type: "move-furniture";
      furnitureId: FurnitureId;
      x: number;
      y: number;
      zone?: FurnitureZone;
    }
  | { type: "remove-furniture"; furnitureId: FurnitureId };

export type BondGift =
  | { level: 5 | 8 | 11 | 14 | 18; kind: "furniture"; id: FurnitureId }
  | { level: 15; kind: "outfit"; id: OutfitId };

export const BOND_GIFTS: readonly BondGift[] = [
  { level: 5, kind: "furniture", id: "flower-gift" },
  { level: 8, kind: "furniture", id: "clover-plant" },
  { level: 11, kind: "furniture", id: "star-hanging" },
  { level: 14, kind: "furniture", id: "rainbow-picture" },
  { level: 15, kind: "outfit", id: "golden-bow" },
  { level: 18, kind: "furniture", id: "cloud-frame" },
] as const;

export type BondGiftGrantResult = {
  save: PetSaveV1;
  granted: BondGift[];
};

function touch(save: PetSaveV1, now: number): PetSaveV1 {
  return {
    ...save,
    revision: Math.max(0, Math.floor(save.revision)) + 1,
    clientUpdatedAt: now,
  };
}

function failed(
  save: PetSaveV1,
  reason: PersonalizationFailureReason,
  grantedGifts: BondGift[] = [],
): PersonalizationResult {
  return { save, applied: false, reason, grantedGifts };
}

function succeeded(
  save: PetSaveV1,
  now: number,
  grantedGifts: BondGift[] = [],
): PersonalizationResult {
  return {
    save: grantedGifts.length > 0 ? save : touch(save, now),
    applied: true,
    grantedGifts,
  };
}

export function normalizePercentage(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

export function equipOutfit(
  save: PetSaveV1,
  outfitId: OutfitId | string,
  now: number = Date.now(),
): PersonalizationResult {
  const gifts = grantEarnedBondGifts(save, now);
  save = gifts.save;
  const outfit = getOutfit(outfitId);
  if (!outfit) return failed(save, "invalid-item", gifts.granted);
  if (!save.inventory.outfits.includes(outfit.id)) {
    return failed(save, "not-owned", gifts.granted);
  }
  if (save.equipped[outfit.slot] === outfit.id) {
    return failed(save, "already-equipped", gifts.granted);
  }
  return succeeded(
    {
      ...save,
      equipped: { ...save.equipped, [outfit.slot]: outfit.id },
    },
    now,
    gifts.granted,
  );
}

export function unequipOutfit(
  save: PetSaveV1,
  slot: OutfitSlot,
  now: number = Date.now(),
): PersonalizationResult {
  const gifts = grantEarnedBondGifts(save, now);
  save = gifts.save;
  if (!save.equipped[slot]) {
    return failed(save, "not-equipped", gifts.granted);
  }
  const equipped = { ...save.equipped };
  delete equipped[slot];
  return succeeded({ ...save, equipped }, now, gifts.granted);
}

export function selectWallpaper(
  save: PetSaveV1,
  wallpaperId: WallpaperId | string,
  now: number = Date.now(),
): PersonalizationResult {
  const gifts = grantEarnedBondGifts(save, now);
  save = gifts.save;
  const wallpaper = getWallpaper(wallpaperId);
  if (!wallpaper) return failed(save, "invalid-item", gifts.granted);
  if (!save.inventory.wallpapers.includes(wallpaper.id)) {
    return failed(save, "not-owned", gifts.granted);
  }
  if (save.room.wallpaperId === wallpaper.id) {
    return failed(save, "already-selected", gifts.granted);
  }
  return succeeded(
    { ...save, room: { ...save.room, wallpaperId: wallpaper.id } },
    now,
    gifts.granted,
  );
}

export function selectFloor(
  save: PetSaveV1,
  floorId: FloorId | string,
  now: number = Date.now(),
): PersonalizationResult {
  const gifts = grantEarnedBondGifts(save, now);
  save = gifts.save;
  const floor = getFloor(floorId);
  if (!floor) return failed(save, "invalid-item", gifts.granted);
  if (!save.inventory.floors.includes(floor.id)) {
    return failed(save, "not-owned", gifts.granted);
  }
  if (save.room.floorId === floor.id) {
    return failed(save, "already-selected", gifts.granted);
  }
  return succeeded(
    { ...save, room: { ...save.room, floorId: floor.id } },
    now,
    gifts.granted,
  );
}

function normalizedPlacement(
  furnitureId: FurnitureId | string,
  x: number,
  y: number,
  zone?: FurnitureZone,
): PlacedFurniture | PersonalizationFailureReason {
  const furniture = getFurniture(furnitureId);
  if (!furniture) return "invalid-item";
  if (zone !== undefined && zone !== furniture.zone) return "wrong-zone";
  const normalizedX = normalizePercentage(x);
  const normalizedY = normalizePercentage(y);
  if (normalizedX === null || normalizedY === null) return "invalid-position";
  return {
    id: furniture.id,
    x: normalizedX,
    y: normalizedY,
    zone: furniture.zone,
  };
}

export function addPlacedFurniture(
  save: PetSaveV1,
  furnitureId: FurnitureId | string,
  x: number,
  y: number,
  zone?: FurnitureZone,
  now: number = Date.now(),
): PersonalizationResult {
  const gifts = grantEarnedBondGifts(save, now);
  save = gifts.save;
  const furniture = getFurniture(furnitureId);
  if (!furniture) return failed(save, "invalid-item", gifts.granted);
  if (!save.inventory.furniture.includes(furniture.id)) {
    return failed(save, "not-owned", gifts.granted);
  }
  if (save.room.placed.some((item) => item.id === furniture.id)) {
    return failed(save, "already-placed", gifts.granted);
  }
  const placement = normalizedPlacement(furniture.id, x, y, zone);
  if (typeof placement === "string") {
    return failed(save, placement, gifts.granted);
  }
  return succeeded(
    {
      ...save,
      room: { ...save.room, placed: [...save.room.placed, placement] },
    },
    now,
    gifts.granted,
  );
}

export function movePlacedFurniture(
  save: PetSaveV1,
  furnitureId: FurnitureId | string,
  x: number,
  y: number,
  zone?: FurnitureZone,
  now: number = Date.now(),
): PersonalizationResult {
  const gifts = grantEarnedBondGifts(save, now);
  save = gifts.save;
  const furniture = getFurniture(furnitureId);
  if (!furniture) return failed(save, "invalid-item", gifts.granted);
  if (!save.inventory.furniture.includes(furniture.id)) {
    return failed(save, "not-owned", gifts.granted);
  }
  const current = save.room.placed.find((item) => item.id === furniture.id);
  if (!current) return failed(save, "not-placed", gifts.granted);
  const placement = normalizedPlacement(furniture.id, x, y, zone);
  if (typeof placement === "string") {
    return failed(save, placement, gifts.granted);
  }
  if (
    current.x === placement.x &&
    current.y === placement.y &&
    current.zone === placement.zone
  ) {
    return failed(save, "no-change", gifts.granted);
  }
  return succeeded(
    {
      ...save,
      room: {
        ...save.room,
        placed: [
          ...save.room.placed.filter((item) => item.id !== furniture.id),
          placement,
        ],
      },
    },
    now,
    gifts.granted,
  );
}

export function removePlacedFurniture(
  save: PetSaveV1,
  furnitureId: FurnitureId | string,
  now: number = Date.now(),
): PersonalizationResult {
  const gifts = grantEarnedBondGifts(save, now);
  save = gifts.save;
  const furniture = getFurniture(furnitureId);
  if (!furniture) return failed(save, "invalid-item", gifts.granted);
  if (!save.inventory.furniture.includes(furniture.id)) {
    return failed(save, "not-owned", gifts.granted);
  }
  if (!save.room.placed.some((item) => item.id === furniture.id)) {
    return failed(save, "not-placed", gifts.granted);
  }
  return succeeded(
    {
      ...save,
      room: {
        ...save.room,
        placed: save.room.placed.filter((item) => item.id !== furniture.id),
      },
    },
    now,
    gifts.granted,
  );
}

export const placeFurniture = addPlacedFurniture;
export const moveFurniture = movePlacedFurniture;
export const removeFurniture = removePlacedFurniture;

export function applyPersonalizationAction(
  save: PetSaveV1,
  action: PersonalizationAction,
  now: number = Date.now(),
): PersonalizationResult {
  switch (action.type) {
    case "equip-outfit":
      return equipOutfit(save, action.outfitId, now);
    case "unequip-outfit":
      return unequipOutfit(save, action.slot, now);
    case "select-wallpaper":
      return selectWallpaper(save, action.wallpaperId, now);
    case "select-floor":
      return selectFloor(save, action.floorId, now);
    case "add-furniture":
      return addPlacedFurniture(
        save,
        action.furnitureId,
        action.x,
        action.y,
        action.zone,
        now,
      );
    case "move-furniture":
      return movePlacedFurniture(
        save,
        action.furnitureId,
        action.x,
        action.y,
        action.zone,
        now,
      );
    case "remove-furniture":
      return removePlacedFurniture(save, action.furnitureId, now);
  }
}

export function getEarnedBondGifts(totalBond: number): BondGift[] {
  const level = getBondLevel(totalBond);
  return BOND_GIFTS.filter((gift) => gift.level <= level);
}

function ownsBondGift(save: PetSaveV1, gift: BondGift): boolean {
  return gift.kind === "outfit"
    ? save.inventory.outfits.includes(gift.id)
    : save.inventory.furniture.includes(gift.id);
}

/** Useful for UI/storage notifications when a transition itself grants gifts. */
export function getNewlyGrantedBondGifts(
  previous: PetSaveV1,
  next: PetSaveV1,
): BondGift[] {
  return BOND_GIFTS.filter(
    (gift) => !ownsBondGift(previous, gift) && ownsBondGift(next, gift),
  );
}

/** Adds all earned gifts without touching revision metadata. */
export function backfillEarnedBondGifts(save: PetSaveV1): BondGiftGrantResult {
  const granted = getEarnedBondGifts(save.bond.total).filter((gift) =>
    !ownsBondGift(save, gift),
  );
  if (granted.length === 0) return { save, granted: [] };

  const outfits = [...save.inventory.outfits];
  const furniture = [...save.inventory.furniture];
  for (const gift of granted) {
    if (gift.kind === "outfit") outfits.push(gift.id);
    else furniture.push(gift.id);
  }
  return {
    save: {
      ...save,
      inventory: { ...save.inventory, outfits, furniture },
    },
    granted,
  };
}

/** Public mutation helper for storage transactions and explicit migrations. */
export function grantEarnedBondGifts(
  save: PetSaveV1,
  now: number = Date.now(),
): BondGiftGrantResult {
  const result = backfillEarnedBondGifts(save);
  return result.granted.length === 0
    ? result
    : { ...result, save: touch(result.save, now) };
}
