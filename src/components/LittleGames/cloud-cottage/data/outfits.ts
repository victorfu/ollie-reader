import {
  OUTFIT_IDS,
  type OutfitDefinition,
  type OutfitId,
} from "../types";

export const OUTFITS: readonly OutfitDefinition[] = [
  { id: "strawberry-clip", nameZh: "草莓髮夾", nameEn: "Strawberry Clip", price: 120, slot: "head", source: "shop" },
  { id: "sailor-hat", nameZh: "水手帽", nameEn: "Sailor Hat", price: 150, slot: "head", source: "shop" },
  { id: "flower-crown", nameZh: "花冠", nameEn: "Flower Crown", price: 180, slot: "head", source: "shop" },
  { id: "star-headband", nameZh: "星星髮箍", nameEn: "Star Headband", price: 200, slot: "head", source: "shop" },
  { id: "red-ribbon", nameZh: "紅色蝴蝶結", nameEn: "Red Ribbon", price: 120, slot: "neck", source: "shop" },
  { id: "blue-scarf", nameZh: "藍色領巾", nameEn: "Blue Scarf", price: 150, slot: "neck", source: "shop" },
  { id: "bell-collar", nameZh: "鈴鐺項圈", nameEn: "Bell Collar", price: 180, slot: "neck", source: "shop" },
  { id: "rainbow-scarf", nameZh: "彩虹圍巾", nameEn: "Rainbow Scarf", price: 220, slot: "neck", source: "shop" },
  { id: "golden-bow", nameZh: "金色蝴蝶結", nameEn: "Golden Bow", price: 0, slot: "head", source: "gift" },
] as const;

export const PURCHASABLE_OUTFITS = OUTFITS.filter(
  (outfit) => outfit.source === "shop",
);

const OUTFIT_BY_ID = new Map<OutfitId, OutfitDefinition>(
  OUTFITS.map((outfit) => [outfit.id, outfit]),
);
const OUTFIT_ID_SET = new Set<string>(OUTFIT_IDS);

export function getOutfit(
  outfitId: OutfitId | string,
): OutfitDefinition | undefined {
  return OUTFIT_BY_ID.get(outfitId as OutfitId);
}

export function isOutfitId(value: unknown): value is OutfitId {
  return typeof value === "string" && OUTFIT_ID_SET.has(value);
}
