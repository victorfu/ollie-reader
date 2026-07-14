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
  "minna-no-tabo",
  "my-sweet-piano",
  "pekkle",
  "osaru-no-monkichi",
  "marumofubiyori",
  "wish-me-mell",
  "aggretsuko",
  "cogimyun",
  "little-forest-fellow",
  "hummingmint",
  "corocorokuririn",
  "usahana",
  "bonbonribbon",
  "charmmy-kitty",
  "marron-cream",
  "we-are-dinosaurs",
  "chococat",
  "cheery-chums",
  "tenorikuma",
  "patty-and-jimmy",
  "sugarbunnies",
  "goropikadon",
  "mewkledreamy",
  "the-runabouts",
  "nya-ni-nyu-nye-nyon",
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
};

export type GachaSaveV1 = {
  schemaVersion: 1;
  resetVersion: number;
  totalDraws: number;
  ownedCounts: Partial<Record<GachaCharacterId, number>>;
};

export type GachaOutcome =
  | { kind: "miss" }
  | { kind: "character"; characterId: GachaCharacterId };

export type GachaDrawResult =
  | {
      kind: "miss";
      totalDraws: number;
    }
  | {
      kind: "character";
      characterId: GachaCharacterId;
      isNew: boolean;
      ownedCount: number;
      totalDraws: number;
    };

export type AppliedGachaAttempt = {
  save: GachaSaveV1;
  result: GachaDrawResult;
};
