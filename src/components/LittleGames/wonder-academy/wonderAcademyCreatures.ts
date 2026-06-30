import lumiPortrait from "../../../assets/games/wonder-academy/starters/lumi-portrait.png";
import momoPortrait from "../../../assets/games/wonder-academy/starters/momo-portrait.png";
import nibiPortrait from "../../../assets/games/wonder-academy/starters/nibi-portrait.png";
import picoPortrait from "../../../assets/games/wonder-academy/starters/pico-portrait.png";
import mossmewPortrait from "../../../assets/games/wonder-academy/wonderlings/mossmew-portrait.png";
import sparkleafFawnPortrait from "../../../assets/games/wonder-academy/wonderlings/sparkleaf-fawn-portrait.png";
import { WONDER_ACADEMY_MOVES } from "../../../data/wonderAcademyMoves";
import type {
  WonderAcademyElement,
  WonderAcademyRarity,
} from "../../../types/wonderAcademy";
import type { BattleCombatant } from "./logic/battleLogic";
import type { WildInfo } from "./logic/battleSession";

export type CreatureSpecies = {
  speciesId: string;
  name: string;
  category: string;
  personality: string;
  elements: WonderAcademyElement[];
  rarity: WonderAcademyRarity;
  favoriteSnack: string;
  growthStages: string[];
  moveIds: string[];
  /** Full pool of moves this species can learn (defaults to moveIds). */
  learnableMoveIds?: string[];
  /** Battle role tag shown in the starter picker (速攻 / 守護 / 巧術 / 坦克). */
  role?: string;
  /** Exploration field skill granted while this creature is on the team. */
  fieldSkillId: string;
  portrait: string;
  /** Appears in the wild and can be befriended on expeditions. */
  wild: boolean;
};

/** Exploration perks a creature's field skill grants while it's on the team. */
export const FIELD_SKILLS: Record<
  string,
  { name: string; emoji: string; desc: string }
> = {
  "light-trail": { name: "光痕", emoji: "✨", desc: "草叢更容易遇到寵物" },
  "soft-float": { name: "柔浮", emoji: "☁️", desc: "從學長姐拿到的點心 +1" },
  "secret-sense": { name: "尋祕", emoji: "🔍", desc: "寶箱多開一樣 · 稀有寵物更常出現" },
  "crystal-push": { name: "晶推", emoji: "💎", desc: "寶箱額外給星塵" },
};

export const WA_CREATURES: CreatureSpecies[] = [
  {
    speciesId: "lumi",
    name: "Lumi",
    category: "星光小狐",
    personality: "聰明、急性子,很想證明自己。",
    elements: ["light", "spark"],
    rarity: "common",
    favoriteSnack: "starberry-cookie",
    growthStages: ["Lumi", "Lumi Tailglow", "Lumi Prismtail", "Lumi Aurorafox"],
    moveIds: ["tiny-flash", "zip-spark", "wink-feint", "starstep-dash"],
    learnableMoveIds: ["tiny-flash", "zip-spark", "wink-feint", "starstep-dash", "aurora-parade"],
    role: "速攻",
    fieldSkillId: "light-trail",
    portrait: lumiPortrait,
    wild: false,
  },
  {
    speciesId: "momo",
    name: "Momo",
    category: "雲朵小貓",
    personality: "愛睡、溫柔,關鍵時刻很可靠。",
    elements: ["dream", "tide"],
    rarity: "common",
    favoriteSnack: "moon-milk-puff",
    growthStages: ["Momo", "Momo Rainpuff", "Momo Mooncloud", "Momo Dreamnimbus"],
    moveIds: ["bubble-pat", "cozy-shield", "nap-song", "moon-drizzle"],
    learnableMoveIds: ["bubble-pat", "cozy-shield", "nap-song", "moon-drizzle", "dreamcloud-haven"],
    role: "守護",
    fieldSkillId: "soft-float",
    portrait: momoPortrait,
    wild: false,
  },
  {
    speciesId: "pico",
    name: "Pico",
    category: "星塵小妖精",
    personality: "好奇、愛惡作劇,很會發現祕密。",
    elements: ["star", "leaf"],
    rarity: "common",
    favoriteSnack: "clover-macaron",
    growthStages: ["Pico", "Pico Budspark", "Pico Wishpetal", "Pico Celestibloom"],
    moveIds: ["leaf-wink", "stardust-peek", "clover-patch", "secret-signal"],
    learnableMoveIds: ["leaf-wink", "stardust-peek", "clover-patch", "secret-signal", "wishbloom-spiral"],
    role: "巧術",
    fieldSkillId: "secret-sense",
    portrait: picoPortrait,
    wild: false,
  },
  {
    speciesId: "nibi",
    name: "Nibi",
    category: "迷你小龍",
    personality: "勇敢、逞強,其實怕寂寞。",
    elements: ["ember", "crystal"],
    rarity: "common",
    favoriteSnack: "warm-cocoa-gem",
    growthStages: ["Nibi", "Nibi Pebblehorn", "Nibi Embercrest", "Nibi Hearthdrake"],
    moveIds: ["warm-puff", "crystal-brace", "brave-bump", "hearth-guard"],
    learnableMoveIds: ["warm-puff", "crystal-brace", "brave-bump", "hearth-guard", "hearth-crystal-roar"],
    role: "坦克",
    fieldSkillId: "crystal-push",
    portrait: nibiPortrait,
    wild: false,
  },
  {
    speciesId: "mossmew",
    name: "Mossmew",
    category: "苔蘚小鼠",
    personality: "膽小,躲在草叢裡偷看你。",
    elements: ["leaf"],
    rarity: "common",
    favoriteSnack: "clover-macaron",
    growthStages: ["Mossmew", "Mossmew Sprig", "Mossmew Thicket"],
    moveIds: ["mossy-tackle", "spore-puff"],
    fieldSkillId: "secret-sense",
    portrait: mossmewPortrait,
    wild: true,
  },
  {
    speciesId: "sparkleaf-fawn",
    name: "Sparkleaf Fawn",
    category: "星葉小鹿",
    personality: "好奇又優雅,喜歡追著光跑。",
    elements: ["leaf", "light"],
    rarity: "uncommon",
    favoriteSnack: "starberry-cookie",
    growthStages: ["Sparkleaf Fawn", "Sparkleaf Stag", "Sparkleaf Monarch"],
    moveIds: ["leaf-wink", "tiny-flash"],
    fieldSkillId: "light-trail",
    portrait: sparkleafFawnPortrait,
    wild: true,
  },
];

export const STARTER_SPECIES = WA_CREATURES.filter((c) => !c.wild);
export const WILD_SPECIES = WA_CREATURES.filter((c) => c.wild);

// Player-created creatures (with their own uploaded art), kept in a runtime
// registry that the game component syncs from the persisted save each render.
const customRegistry = new Map<string, CreatureSpecies>();

export function registerCustomCreatures(list: CreatureSpecies[]): void {
  customRegistry.clear();
  for (const c of list) customRegistry.set(c.speciesId, c);
}

export function speciesById(id: string): CreatureSpecies | undefined {
  return WA_CREATURES.find((c) => c.speciesId === id) ?? customRegistry.get(id);
}

export function allSpecies(): CreatureSpecies[] {
  return [...WA_CREATURES, ...customRegistry.values()];
}

export function catchableSpecies(): CreatureSpecies[] {
  return [...WILD_SPECIES, ...customRegistry.values()];
}

function movesForElements(elements: WonderAcademyElement[]): string[] {
  const matched = Object.values(WONDER_ACADEMY_MOVES)
    .filter((m) => elements.includes(m.element))
    .map((m) => m.id);
  return matched.length > 0 ? matched.slice(0, 4) : ["tiny-flash"];
}

function fieldSkillForElements(elements: WonderAcademyElement[]): string {
  const primary = elements[0] ?? "light";
  if (primary === "dream" || primary === "tide") return "soft-float";
  if (primary === "star" || primary === "leaf") return "secret-sense";
  if (primary === "ember" || primary === "crystal") return "crystal-push";
  return "light-trail";
}

export function makeCustomCreature(input: {
  name: string;
  portrait: string;
  elements: WonderAcademyElement[];
  favoriteSnack: string;
  seed: number;
}): CreatureSpecies {
  const elements: WonderAcademyElement[] =
    input.elements.length > 0 ? input.elements : ["light"];
  const name = input.name.trim() || "新夥伴";
  return {
    speciesId: `custom-${input.seed}`,
    name,
    category: "自訂夥伴",
    personality: "你親手加入的特別夥伴。",
    elements,
    rarity: "rare",
    favoriteSnack: input.favoriteSnack,
    growthStages: [name],
    moveIds: movesForElements(elements),
    fieldSkillId: fieldSkillForElements(elements),
    portrait: input.portrait,
    wild: true,
  };
}

/** Simple, predictable stat curve (kid-friendly). */
export function combatStats(level: number): { maxHp: number; attack: number } {
  return { maxHp: 30 + level * 5, attack: 4 + level };
}

export type OwnedCreature = {
  ownedId: string;
  speciesId: string;
  nickname: string;
  level: number;
  xp: number;
  bond: number;
  stage: number;
  equippedMoveIds?: string[];
  /** Rare colour variant. */
  shiny?: boolean;
};

/** CSS filter that gives a portrait the rare "shiny" sheen. */
export const SHINY_FILTER =
  "hue-rotate(38deg) saturate(1.5) brightness(1.06) drop-shadow(0 0 7px rgba(255,216,110,.95))";

/** ~1 in 16 wild creatures sparkles. */
export function rollShiny(rng: () => number): boolean {
  return rng() < 1 / 16;
}

export function learnablePool(species: CreatureSpecies): string[] {
  return species.learnableMoveIds ?? species.moveIds;
}

/** Level at which the move at the given pool index becomes learnable. */
export function moveUnlockLevel(index: number): number {
  return 1 + index * 2;
}

export function defaultEquipped(species: CreatureSpecies): string[] {
  return learnablePool(species).slice(0, 4);
}

export function toCombatant(owned: OwnedCreature): BattleCombatant {
  const species = speciesById(owned.speciesId);
  const elements = species?.elements ?? ["light"];
  const moveIds =
    owned.equippedMoveIds && owned.equippedMoveIds.length > 0
      ? owned.equippedMoveIds.slice(0, 4)
      : species?.moveIds.slice(0, 4) ?? ["tiny-flash"];
  const { maxHp, attack } = combatStats(owned.level);
  return {
    ownedId: owned.ownedId,
    speciesId: owned.speciesId,
    name:
      owned.nickname ||
      species?.growthStages[owned.stage] ||
      species?.name ||
      owned.speciesId,
    elements,
    level: owned.level,
    maxHp,
    hp: maxHp,
    attack,
    moveIds,
    shiny: owned.shiny,
  };
}

export function toWild(species: CreatureSpecies, level: number, shiny = false): WildInfo {
  const { maxHp, attack } = combatStats(level);
  return {
    combatant: {
      ownedId: `wild-${species.speciesId}`,
      speciesId: species.speciesId,
      name: species.name,
      elements: species.elements,
      level,
      maxHp,
      hp: maxHp,
      attack,
      moveIds: species.moveIds,
      shiny,
    },
    rarity: species.rarity,
    favoriteSnack: species.favoriteSnack,
  };
}

/** A boosted boss version of a species — for warden / guardian battles. */
export function toWarden(species: CreatureSpecies, level: number): WildInfo {
  const { maxHp, attack } = combatStats(level);
  const bossHp = Math.round(maxHp * 1.7);
  return {
    combatant: {
      ownedId: `warden-${species.speciesId}`,
      speciesId: species.speciesId,
      name: `${species.name}(魔王)`,
      elements: species.elements,
      level,
      maxHp: bossHp,
      hp: bossHp,
      attack: attack + 4,
      moveIds: species.moveIds,
    },
    rarity: "warden",
    favoriteSnack: species.favoriteSnack,
  };
}

export const ELEMENT_META: Record<
  WonderAcademyElement,
  { label: string; emoji: string; fg: string; bg: string }
> = {
  spark: { label: "spark", emoji: "⚡", fg: "#c98a12", bg: "#fff4d6" },
  tide: { label: "tide", emoji: "🌊", fg: "#3f7fb8", bg: "#e3f1ff" },
  leaf: { label: "leaf", emoji: "🍀", fg: "#3a9e63", bg: "#e2f7e9" },
  light: { label: "light", emoji: "☀️", fg: "#c98a12", bg: "#fff4d6" },
  dream: { label: "dream", emoji: "🌙", fg: "#6a5bd0", bg: "#ece9ff" },
  ember: { label: "ember", emoji: "🔥", fg: "#d4622f", bg: "#ffe6dd" },
  crystal: { label: "crystal", emoji: "💎", fg: "#5a8bb0", bg: "#e6f0f7" },
  star: { label: "star", emoji: "⭐", fg: "#caa11a", bg: "#fff6d4" },
};
