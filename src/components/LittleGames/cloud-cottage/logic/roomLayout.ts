import { getFurniture } from "../data/furniture";
import type { FurnitureId, FurnitureZone, PlacedFurniture } from "../types";
import { FURNITURE_VISUALS } from "../ui/cottageAssets";
import { FURNITURE_METRICS } from "../ui/spriteMetrics";

export type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** The room canvas is 3:2, and every placement percentage assumes it. */
export const ROOM_ASPECT = 3 / 2;

/**
 * Where each kind of furniture is allowed to sit, as the *centre point* of the
 * sprite. Wall pieces hang above the skirting; floor pieces stand below it.
 */
export const ZONE_BOUNDS: Readonly<Record<FurnitureZone, Bounds>> = {
  wall: { minX: 7, maxX: 93, minY: 12, maxY: 53 },
  floor: { minX: 7, maxX: 93, minY: 63, maxY: 89 },
};

/**
 * Half the rendered size of a sprite, in room percentage units.
 *
 * Vertical and horizontal percentages are not interchangeable here: the room is
 * 3:2, so a sprite occupying 34% of the width occupies 34 * (h/w) * 1.5 percent
 * of the *height*. Ignoring that factor is what let the cloud bed — 34% wide,
 * but 47% tall — be centred at y=89 and hang 12% below the floor, where
 * `overflow-hidden` sliced it in half.
 */
export function spriteHalfExtents(furnitureId: FurnitureId): {
  halfXPercent: number;
  halfYPercent: number;
} {
  const visual = FURNITURE_VISUALS[furnitureId];
  const metrics = FURNITURE_METRICS[furnitureId];
  const widthPercent = visual.widthPercent;
  const heightPercent =
    widthPercent * (metrics.height / metrics.width) * ROOM_ASPECT;
  return {
    halfXPercent: widthPercent / 2,
    halfYPercent: heightPercent / 2,
  };
}

/**
 * The legal centre points for a sprite: its zone, tightened so the whole sprite
 * stays inside the room.
 *
 * `RoomWorld` applies the visual's fine-tuning offsets *after* the saved
 * coordinate, so they are folded in here — otherwise the rug, nudged down 3%,
 * would clear this check and still be clipped on screen.
 *
 * A sprite too large for its zone collapses to the midpoint rather than
 * producing inverted bounds.
 */
export function placementBounds(furnitureId: FurnitureId): Bounds {
  const zone = getFurniture(furnitureId)?.zone ?? "floor";
  const bounds = ZONE_BOUNDS[zone];
  const { halfXPercent, halfYPercent } = spriteHalfExtents(furnitureId);
  const visual = FURNITURE_VISUALS[furnitureId];
  const offsetX = visual.offsetXPercent ?? 0;
  const offsetY = visual.offsetYPercent ?? 0;

  const minX = Math.max(bounds.minX, halfXPercent - offsetX);
  const maxX = Math.min(bounds.maxX, 100 - halfXPercent - offsetX);
  const minY = Math.max(bounds.minY, halfYPercent - offsetY);
  const maxY = Math.min(bounds.maxY, 100 - halfYPercent - offsetY);

  return {
    minX: minX <= maxX ? minX : (bounds.minX + bounds.maxX) / 2,
    maxX: minX <= maxX ? maxX : (bounds.minX + bounds.maxX) / 2,
    minY: minY <= maxY ? minY : (bounds.minY + bounds.maxY) / 2,
    maxY: minY <= maxY ? maxY : (bounds.minY + bounds.maxY) / 2,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Snaps a placement to a position where the whole sprite is visible. Returns
 * null for an unknown id or a non-finite coordinate.
 *
 * This is the single clamp for the game: the editor uses it while dragging,
 * `personalization` uses it before committing to Firestore, and
 * `normalizePetSave` uses it on load, which quietly repairs saves that were
 * written before sprite size was taken into account.
 */
export function clampPlacement(
  furnitureId: FurnitureId | string,
  x: number,
  y: number,
): PlacedFurniture | null {
  const furniture = getFurniture(furnitureId);
  if (!furniture) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const bounds = placementBounds(furniture.id);
  return {
    id: furniture.id,
    x: round(clamp(x, bounds.minX, bounds.maxX)),
    y: round(clamp(y, bounds.minY, bounds.maxY)),
    zone: furniture.zone,
  };
}
