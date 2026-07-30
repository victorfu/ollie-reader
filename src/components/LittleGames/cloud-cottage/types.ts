export const FREE_FOOD_IDS = ["milk", "cookie"] as const;
export type FreeFoodId = (typeof FREE_FOOD_IDS)[number];

export const SNACK_IDS = [
  "apple",
  "banana-yogurt",
  "pudding",
  "honey-toast",
  "strawberry-pancake",
  "cinnamon-roll",
  "rainbow-donut",
  "cloud-cake",
] as const;
export type SnackId = (typeof SNACK_IDS)[number];
export type FoodId = FreeFoodId | SnackId;

export const TOY_IDS = [
  "ball",
  "frisbee",
  "bubble-machine",
  "music-box",
  "cloud-swing",
] as const;
export type ToyId = (typeof TOY_IDS)[number];

export const OUTFIT_IDS = [
  "strawberry-clip",
  "sailor-hat",
  "flower-crown",
  "star-headband",
  "red-ribbon",
  "blue-scarf",
  "bell-collar",
  "rainbow-scarf",
  "golden-bow",
] as const;
export type OutfitId = (typeof OUTFIT_IDS)[number];
export type OutfitSlot = "head" | "neck";

export const FURNITURE_IDS = [
  "cloud-bed",
  "lamp",
  "plant",
  "picture",
  "rug",
  "table",
  "curtain",
  "sofa",
  "bookshelf",
  "flower-gift",
  "clover-plant",
  "star-hanging",
  "rainbow-picture",
  "cloud-frame",
] as const;
export type FurnitureId = (typeof FURNITURE_IDS)[number];
export type FurnitureZone = "floor" | "wall";

export const WALLPAPER_IDS = [
  "cloud-blue",
  "starry-night",
  "candy-stripes",
  "forest",
] as const;
export type WallpaperId = (typeof WALLPAPER_IDS)[number];

export const FLOOR_IDS = [
  "cream-wood",
  "cloud-carpet",
  "frosting-check",
] as const;
export type FloorId = (typeof FLOOR_IDS)[number];

export type LocalDate = string;

export type PetStats = {
  fullness: number;
  clean: number;
  mood: number;
  statsAt: number;
};

export type PetBond = {
  total: number;
  earnedToday: number;
  earnedDate: LocalDate;
};

export type FreeFoodStock = Record<FreeFoodId, number> & {
  restockDate: LocalDate;
};

export type PetInventory = {
  snacks: Partial<Record<SnackId, number>>;
  toys: ToyId[];
  outfits: OutfitId[];
  furniture: FurnitureId[];
  wallpapers: WallpaperId[];
  floors: FloorId[];
};

export type PlacedFurniture = {
  id: FurnitureId;
  x: number;
  y: number;
  zone: FurnitureZone;
};

export type PetWish = {
  date: LocalDate;
  wishId: string;
  fulfilled: boolean;
  progress: number;
  target: number;
};

/**
 * Cache-safe save shape. Firestore server timestamps belong to the persistence
 * envelope and deliberately do not appear here, so every PetSaveV1 can be
 * serialized to JSON without special handling.
 */
export type PetSaveV1 = {
  schemaVersion: 1;
  revision: number;
  clientUpdatedAt: number;
  stats: PetStats;
  bond: PetBond;
  lastVisitAt: number;
  lastSleepDate: LocalDate;
  sleepingUntil: number | null;
  freeFood: FreeFoodStock;
  inventory: PetInventory;
  equipped: {
    head?: OutfitId;
    neck?: OutfitId;
  };
  room: {
    wallpaperId: WallpaperId;
    floorId: FloorId;
    placed: PlacedFurniture[];
  };
  wish: PetWish;
};

export type FoodDefinition = {
  id: FoodId;
  kind: "free" | "snack";
  nameZh: string;
  nameEn: string;
  price: number;
  fullnessGain: number;
  moodGain: number;
  bondGain: number;
};

export type ToyDefinition = {
  id: ToyId;
  nameZh: string;
  nameEn: string;
  price: number;
  moodGain: number;
  bondGain: number;
};

export type PermanentItemSource = "default" | "shop" | "gift";

export type OutfitDefinition = {
  id: OutfitId;
  nameZh: string;
  nameEn: string;
  price: number;
  slot: OutfitSlot;
  source: "shop" | "gift";
};

export type FurnitureDefinition = {
  id: FurnitureId;
  nameZh: string;
  nameEn: string;
  price: number;
  zone: FurnitureZone;
  source: PermanentItemSource;
};

export type WallpaperDefinition = {
  id: WallpaperId;
  nameZh: string;
  nameEn: string;
  price: number;
  source: "default" | "shop";
};

export type FloorDefinition = {
  id: FloorId;
  nameZh: string;
  nameEn: string;
  price: number;
  source: "default" | "shop";
};

export type PhraseContext =
  | "greeting"
  | "care"
  | "sleep"
  | "return"
  | "status"
  | "bond";

export type PhraseDefinition = {
  id: string;
  en: string;
  zh: string;
  context: PhraseContext;
  unlockLevel: number;
};

export type WishAction =
  | { type: "pet" }
  | { type: "bath" }
  | { type: "feed"; foodId: FoodId }
  | { type: "play"; toyId: ToyId }
  | { type: "sleep" };

export type WishDefinition = {
  id: string;
  nameZh: string;
  nameEn: string;
  target: number;
  action: WishAction;
  /** Weight within the complete, eligible daily pool. */
  weight: number;
  kind: "free" | "toy" | "snack";
};

export type BondUnlock = {
  level: number;
  type: "phrase" | "action" | "gift" | "celebration";
  id: string;
  nameZh: string;
  nameEn: string;
  phase: 1 | 2;
};

export type CottageProduct =
  | {
      kind: "snack";
      id: SnackId;
      nameZh: string;
      nameEn: string;
      price: number;
    }
  | {
      kind: "toy";
      id: ToyId;
      nameZh: string;
      nameEn: string;
      price: number;
    }
  | {
      kind: "outfit";
      id: OutfitId;
      nameZh: string;
      nameEn: string;
      price: number;
      slot: OutfitSlot;
    }
  | {
      kind: "furniture";
      id: FurnitureId;
      nameZh: string;
      nameEn: string;
      price: number;
      zone: FurnitureZone;
    }
  | {
      kind: "wallpaper";
      id: WallpaperId;
      nameZh: string;
      nameEn: string;
      price: number;
    }
  | {
      kind: "floor";
      id: FloorId;
      nameZh: string;
      nameEn: string;
      price: number;
    };

export type CottageProductId =
  | SnackId
  | ToyId
  | OutfitId
  | FurnitureId
  | WallpaperId
  | FloorId;
