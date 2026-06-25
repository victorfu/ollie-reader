import lumiPortrait from "../../../assets/games/wonder-academy/starters/lumi-portrait.png";
import momoPortrait from "../../../assets/games/wonder-academy/starters/momo-portrait.png";
import nibiPortrait from "../../../assets/games/wonder-academy/starters/nibi-portrait.png";
import picoPortrait from "../../../assets/games/wonder-academy/starters/pico-portrait.png";
import mossmewPortrait from "../../../assets/games/wonder-academy/wonderlings/mossmew-portrait.png";
import sparkleafFawnPortrait from "../../../assets/games/wonder-academy/wonderlings/sparkleaf-fawn-portrait.png";
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
  portrait: string;
  /** Appears in the wild and can be befriended on expeditions. */
  wild: boolean;
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
    portrait: sparkleafFawnPortrait,
    wild: true,
  },
];

export const STARTER_SPECIES = WA_CREATURES.filter((c) => !c.wild);
export const WILD_SPECIES = WA_CREATURES.filter((c) => c.wild);

export function speciesById(id: string): CreatureSpecies | undefined {
  return WA_CREATURES.find((c) => c.speciesId === id);
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
};

export function toCombatant(owned: OwnedCreature): BattleCombatant {
  const species = speciesById(owned.speciesId);
  const elements = species?.elements ?? ["light"];
  const moveIds = species?.moveIds.slice(0, 4) ?? ["tiny-flash"];
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
  };
}

export function toWild(species: CreatureSpecies, level: number): WildInfo {
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
    },
    rarity: species.rarity,
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
