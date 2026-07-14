export type GachaView = "machine" | "collection";

export type GachaPhase =
  | "idle"
  | "coinInserted"
  | "turning"
  | "capsuleReady"
  | "revealed";

export const GACHA_CHARACTER_IDS = [
  "hello-kitty",
  "my-melody",
  "cinnamoroll",
  "pompompurin",
  "little-twin-stars",
  "keroppi",
  "pochacco",
  "kuromi",
  "badtz-maru",
  "tuxedosam",
  "hangyodon",
  "gudetama",
] as const;

export type GachaCharacterId = (typeof GACHA_CHARACTER_IDS)[number];

const GACHA_CHARACTER_ID_SET = new Set<string>(GACHA_CHARACTER_IDS);

export function isGachaCharacterId(value: unknown): value is GachaCharacterId {
  return typeof value === "string" && GACHA_CHARACTER_ID_SET.has(value);
}

export type GachaCharacter = {
  id: GachaCharacterId;
  name: string;
  englishName: string;
  imageUrl: string;
  capsuleColor: string;
};

export type GachaSaveV1 = {
  schemaVersion: 1;
  totalDraws: number;
  ownedCounts: Partial<Record<GachaCharacterId, number>>;
};

export type GachaDrawResult = {
  characterId: GachaCharacterId;
  isNew: boolean;
  ownedCount: number;
  totalDraws: number;
};

export type AppliedGachaDraw = {
  save: GachaSaveV1;
  result: GachaDrawResult;
};
