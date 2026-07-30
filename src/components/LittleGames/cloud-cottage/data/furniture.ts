import {
  FLOOR_IDS,
  FURNITURE_IDS,
  WALLPAPER_IDS,
  type FloorDefinition,
  type FloorId,
  type FurnitureDefinition,
  type FurnitureId,
  type WallpaperDefinition,
  type WallpaperId,
} from "../types";

export const FURNITURE: readonly FurnitureDefinition[] = [
  { id: "cloud-bed", nameZh: "雲朵床", nameEn: "Cloud Bed", price: 0, zone: "floor", source: "default" },
  { id: "lamp", nameZh: "檯燈", nameEn: "Lamp", price: 80, zone: "floor", source: "shop" },
  { id: "plant", nameZh: "盆栽", nameEn: "Plant", price: 80, zone: "floor", source: "shop" },
  { id: "picture", nameZh: "掛畫", nameEn: "Picture", price: 100, zone: "wall", source: "shop" },
  { id: "rug", nameZh: "地毯", nameEn: "Rug", price: 100, zone: "floor", source: "shop" },
  { id: "table", nameZh: "圓桌", nameEn: "Table", price: 120, zone: "floor", source: "shop" },
  { id: "curtain", nameZh: "窗簾", nameEn: "Curtain", price: 120, zone: "wall", source: "shop" },
  { id: "sofa", nameZh: "小沙發", nameEn: "Sofa", price: 150, zone: "floor", source: "shop" },
  { id: "bookshelf", nameZh: "書架", nameEn: "Bookshelf", price: 150, zone: "floor", source: "shop" },
  { id: "flower-gift", nameZh: "一朵小花", nameEn: "Little Flower", price: 0, zone: "floor", source: "gift" },
  { id: "clover-plant", nameZh: "幸運草盆栽", nameEn: "Lucky Clover", price: 0, zone: "floor", source: "gift" },
  { id: "star-hanging", nameZh: "星星掛飾", nameEn: "Star Hanging", price: 0, zone: "wall", source: "gift" },
  { id: "rainbow-picture", nameZh: "彩虹掛畫", nameEn: "Rainbow Picture", price: 0, zone: "wall", source: "gift" },
  { id: "cloud-frame", nameZh: "雲朵相框", nameEn: "Cloud Frame", price: 0, zone: "wall", source: "gift" },
] as const;

export const WALLPAPERS: readonly WallpaperDefinition[] = [
  { id: "cloud-blue", nameZh: "粉藍雲朵", nameEn: "Cloud Blue", price: 0, source: "default" },
  { id: "starry-night", nameZh: "星空", nameEn: "Starry Night", price: 200, source: "shop" },
  { id: "candy-stripes", nameZh: "糖果條紋", nameEn: "Candy Stripes", price: 200, source: "shop" },
  { id: "forest", nameZh: "森林", nameEn: "Forest", price: 200, source: "shop" },
] as const;

export const FLOORS: readonly FloorDefinition[] = [
  { id: "cream-wood", nameZh: "奶油木地板", nameEn: "Cream Wood", price: 0, source: "default" },
  { id: "cloud-carpet", nameZh: "雲朵地毯", nameEn: "Cloud Carpet", price: 200, source: "shop" },
  { id: "frosting-check", nameZh: "糖霜格紋", nameEn: "Frosting Check", price: 200, source: "shop" },
] as const;

export const PURCHASABLE_FURNITURE = FURNITURE.filter(
  (item) => item.source === "shop",
);
export const PURCHASABLE_WALLPAPERS = WALLPAPERS.filter(
  (item) => item.source === "shop",
);
export const PURCHASABLE_FLOORS = FLOORS.filter(
  (item) => item.source === "shop",
);

const FURNITURE_BY_ID = new Map<FurnitureId, FurnitureDefinition>(
  FURNITURE.map((item) => [item.id, item]),
);
const WALLPAPER_BY_ID = new Map<WallpaperId, WallpaperDefinition>(
  WALLPAPERS.map((item) => [item.id, item]),
);
const FLOOR_BY_ID = new Map<FloorId, FloorDefinition>(
  FLOORS.map((item) => [item.id, item]),
);
const FURNITURE_ID_SET = new Set<string>(FURNITURE_IDS);
const WALLPAPER_ID_SET = new Set<string>(WALLPAPER_IDS);
const FLOOR_ID_SET = new Set<string>(FLOOR_IDS);

export function getFurniture(
  furnitureId: FurnitureId | string,
): FurnitureDefinition | undefined {
  return FURNITURE_BY_ID.get(furnitureId as FurnitureId);
}

export function getWallpaper(
  wallpaperId: WallpaperId | string,
): WallpaperDefinition | undefined {
  return WALLPAPER_BY_ID.get(wallpaperId as WallpaperId);
}

export function getFloor(
  floorId: FloorId | string,
): FloorDefinition | undefined {
  return FLOOR_BY_ID.get(floorId as FloorId);
}

export function isFurnitureId(value: unknown): value is FurnitureId {
  return typeof value === "string" && FURNITURE_ID_SET.has(value);
}

export function isWallpaperId(value: unknown): value is WallpaperId {
  return typeof value === "string" && WALLPAPER_ID_SET.has(value);
}

export function isFloorId(value: unknown): value is FloorId {
  return typeof value === "string" && FLOOR_ID_SET.has(value);
}
