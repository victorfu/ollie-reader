import lumiPortrait from "../../../assets/games/wonder-academy/starters/lumi-portrait.png";
import momoPortrait from "../../../assets/games/wonder-academy/starters/momo-portrait.png";
import nibiPortrait from "../../../assets/games/wonder-academy/starters/nibi-portrait.png";
import picoPortrait from "../../../assets/games/wonder-academy/starters/pico-portrait.png";
import mossmewPortrait from "../../../assets/games/wonder-academy/wonderlings/mossmew-portrait.png";
import sparkleafFawnPortrait from "../../../assets/games/wonder-academy/wonderlings/sparkleaf-fawn-portrait.png";
import pearlwhiskerSealPortrait from "../../../assets/games/wonder-academy/wonderlings/pearlwhisker-seal-portrait.png";
import clockbellTanukiPortrait from "../../../assets/games/wonder-academy/wonderlings/clockbell-tanuki-portrait.png";
import marshmallowMaestroPortrait from "../../../assets/games/wonder-academy/wonderlings/marshmallow-maestro-portrait.png";
import auroraAlpacaPortrait from "../../../assets/games/wonder-academy/wonderlings/aurora-alpaca-portrait.png";
import cometKitsunePortrait from "../../../assets/games/wonder-academy/wonderlings/comet-kitsune-portrait.png";
import pillowmoonRamPortrait from "../../../assets/games/wonder-academy/wonderlings/pillowmoon-ram-portrait.png";
import silentBellheartPortrait from "../../../assets/games/wonder-academy/wonderlings/silent-bellheart-portrait.png";
import glimmerbunPortrait from "../../../assets/games/wonder-academy/wonderlings/glimmerbun-portrait.png";
import tideshellOtterPortrait from "../../../assets/games/wonder-academy/wonderlings/tideshell-otter-portrait.png";
import embercapSalamanderPortrait from "../../../assets/games/wonder-academy/wonderlings/embercap-salamander-portrait.png";
import crystalmothPortrait from "../../../assets/games/wonder-academy/wonderlings/crystalmoth-portrait.png";
import sugarquillHedgehogPortrait from "../../../assets/games/wonder-academy/wonderlings/sugarquill-hedgehog-portrait.png";
import moonpaperCranePortrait from "../../../assets/games/wonder-academy/wonderlings/moonpaper-crane-portrait.png";
import gearpawCubPortrait from "../../../assets/games/wonder-academy/wonderlings/gearpaw-cub-portrait.png";
import snowdriftPenguinPortrait from "../../../assets/games/wonder-academy/wonderlings/snowdrift-penguin-portrait.png";
import lanternNewtPortrait from "../../../assets/games/wonder-academy/wonderlings/lantern-newt-portrait.png";
import cloverwhirlSnailPortrait from "../../../assets/games/wonder-academy/wonderlings/cloverwhirl-snail-portrait.png";
import prismbellGryphonPortrait from "../../../assets/games/wonder-academy/wonderlings/prismbell-gryphon-portrait.png";
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
  {
    speciesId: "pearlwhisker-seal",
    name: "Pearlwhisker Seal",
    category: "珍珠鬍海豹",
    personality: "喜歡聽海浪,會用鬍鬚找回迷路的小船。",
    elements: ["tide", "dream"],
    rarity: "rare",
    favoriteSnack: "moon-milk-puff",
    growthStages: ["Pearlwhisker Pup", "Pearlwhisker Seal", "Pearlwhisker Oracle"],
    moveIds: ["pearl-splash", "tideglass-song", "seal-slide"],
    learnableMoveIds: ["pearl-splash", "tideglass-song", "seal-slide", "moon-drizzle"],
    fieldSkillId: "soft-float",
    portrait: pearlwhiskerSealPortrait,
    wild: true,
  },
  {
    speciesId: "clockbell-tanuki",
    name: "Clockbell Tanuki",
    category: "鐘鈴狸",
    personality: "總是慢半拍,但能聽見時間齒輪的聲音。",
    elements: ["crystal", "star"],
    rarity: "warden",
    favoriteSnack: "warm-cocoa-gem",
    growthStages: ["Clockbell Kit", "Clockbell Tanuki", "Clockbell Keeper"],
    moveIds: ["clockwork-tap", "bell-chime", "tanuki-twirl"],
    learnableMoveIds: ["clockwork-tap", "bell-chime", "tanuki-twirl", "secret-signal"],
    fieldSkillId: "crystal-push",
    portrait: clockbellTanukiPortrait,
    wild: true,
  },
  {
    speciesId: "marshmallow-maestro",
    name: "Marshmallow Maestro",
    category: "棉花糖指揮家",
    personality: "把點心排成樂譜,一開心就讓整條街變甜。",
    elements: ["dream", "light"],
    rarity: "rare",
    favoriteSnack: "starberry-cookie",
    growthStages: ["Mallow Tapper", "Marshmallow Maestro", "Sugarcloud Conductor"],
    moveIds: ["sugar-sparkle", "marshmallow-bounce", "maestro-finale"],
    learnableMoveIds: ["sugar-sparkle", "marshmallow-bounce", "maestro-finale", "aurora-parade"],
    fieldSkillId: "soft-float",
    portrait: marshmallowMaestroPortrait,
    wild: true,
  },
  {
    speciesId: "aurora-alpaca",
    name: "Aurora Alpaca",
    category: "極光羊駝",
    personality: "慢慢走過雪鈴山脊,會用極光圍巾安撫受傷的夥伴。",
    elements: ["light", "crystal"],
    rarity: "warden",
    favoriteSnack: "warm-cocoa-gem",
    growthStages: ["Aurora Cria", "Aurora Alpaca", "Snowbell Alpaca"],
    moveIds: ["aurora-parade", "crystal-brace", "cozy-shield"],
    learnableMoveIds: ["aurora-parade", "crystal-brace", "cozy-shield", "heart-crystal"],
    fieldSkillId: "crystal-push",
    portrait: auroraAlpacaPortrait,
    wild: true,
  },
  {
    speciesId: "comet-kitsune",
    name: "Comet Kitsune",
    category: "彗星小狐",
    personality: "只在星軌很亮的夜晚現身,跑過時會留下銀色尾光。",
    elements: ["star", "spark"],
    rarity: "rare",
    favoriteSnack: "clover-macaron",
    growthStages: ["Comet Kit", "Comet Kitsune", "Starrail Kitsune", "Nova Kitsune"],
    moveIds: ["comet-dash", "starrail-echo"],
    learnableMoveIds: ["comet-dash", "starrail-echo", "zip-spark", "wishbloom-spiral"],
    fieldSkillId: "secret-sense",
    portrait: cometKitsunePortrait,
    wild: true,
  },
  {
    speciesId: "pillowmoon-ram",
    name: "Pillowmoon Ram",
    category: "枕月綿羊",
    personality: "走到哪裡都帶著月光枕頭,能讓緊張的夥伴放鬆。",
    elements: ["dream", "star"],
    rarity: "rare",
    favoriteSnack: "moon-milk-puff",
    growthStages: ["Pillow Lamb", "Pillowmoon Ram", "Lullaby Ram"],
    moveIds: ["pillow-moonbeam", "dream-drift", "stardust-peek"],
    learnableMoveIds: ["pillow-moonbeam", "dream-drift", "stardust-peek", "dreamcloud-haven"],
    fieldSkillId: "soft-float",
    portrait: pillowmoonRamPortrait,
    wild: true,
  },
  {
    speciesId: "glimmerbun",
    name: "Glimmerbun",
    category: "光葉兔",
    personality: "長耳會像小燈一樣亮起,替迷路的新生指路。",
    elements: ["light", "leaf"],
    rarity: "common",
    favoriteSnack: "starberry-cookie",
    growthStages: ["Glimmerbun", "Glimmerhop", "Glimmerleaf"],
    moveIds: ["tiny-flash", "leaf-wink", "clover-patch"],
    learnableMoveIds: ["tiny-flash", "leaf-wink", "clover-patch", "aurora-parade"],
    fieldSkillId: "light-trail",
    portrait: glimmerbunPortrait,
    wild: true,
  },
  {
    speciesId: "tideshell-otter",
    name: "Tideshell Otter",
    category: "潮貝水獺",
    personality: "會把海玻璃藏進貝殼背包,遇到朋友就拿出來交換。",
    elements: ["tide", "spark"],
    rarity: "uncommon",
    favoriteSnack: "moon-milk-puff",
    growthStages: ["Tideshell Pup", "Tideshell Otter", "Pearlcurrent Otter"],
    moveIds: ["bubble-pat", "pearl-splash", "zip-spark"],
    learnableMoveIds: ["bubble-pat", "pearl-splash", "zip-spark", "seal-slide"],
    fieldSkillId: "soft-float",
    portrait: tideshellOtterPortrait,
    wild: true,
  },
  {
    speciesId: "embercap-salamander",
    name: "Embercap Salamander",
    category: "火帽蠑螈",
    personality: "頭上的菇帽會暖暖發光,最喜歡在雨後找新芽。",
    elements: ["ember", "leaf"],
    rarity: "common",
    favoriteSnack: "warm-cocoa-gem",
    growthStages: ["Embercap Newt", "Embercap Salamander", "Cinderleaf Salamander"],
    moveIds: ["warm-puff", "mossy-tackle", "spore-puff"],
    learnableMoveIds: ["warm-puff", "mossy-tackle", "spore-puff", "brave-bump"],
    fieldSkillId: "secret-sense",
    portrait: embercapSalamanderPortrait,
    wild: true,
  },
  {
    speciesId: "crystalmoth",
    name: "Crystalmoth",
    category: "晶翼蛾",
    personality: "只在安靜的夜裡拍動晶翼,把星塵撒在窗台上。",
    elements: ["crystal", "star"],
    rarity: "uncommon",
    favoriteSnack: "warm-cocoa-gem",
    growthStages: ["Crystal Larva", "Crystalmoth", "Prismwing Moth"],
    moveIds: ["crystal-brace", "bell-chime", "stardust-peek"],
    learnableMoveIds: ["crystal-brace", "bell-chime", "stardust-peek", "secret-signal"],
    fieldSkillId: "crystal-push",
    portrait: crystalmothPortrait,
    wild: true,
  },
  {
    speciesId: "sugarquill-hedgehog",
    name: "Sugarquill Hedgehog",
    category: "糖刺刺蝟",
    personality: "把糖霜刺排得整整齊齊,緊張時會唱很小聲的甜點歌。",
    elements: ["dream", "ember"],
    rarity: "rare",
    favoriteSnack: "starberry-cookie",
    growthStages: ["Sugarquill", "Sugarquill Hedgehog", "Brulee Quillhog"],
    moveIds: ["nap-song", "warm-puff", "marshmallow-bounce"],
    learnableMoveIds: ["nap-song", "warm-puff", "marshmallow-bounce", "maestro-finale"],
    fieldSkillId: "soft-float",
    portrait: sugarquillHedgehogPortrait,
    wild: true,
  },
  {
    speciesId: "moonpaper-crane",
    name: "Moonpaper Crane",
    category: "月紙鶴",
    personality: "身上的摺痕記著夢境地圖,會把壞夢摺成星星。",
    elements: ["dream", "star"],
    rarity: "rare",
    favoriteSnack: "moon-milk-puff",
    growthStages: ["Moonpaper Chick", "Moonpaper Crane", "Lunar Origami Crane"],
    moveIds: ["dream-drift", "pillow-moonbeam", "secret-signal"],
    learnableMoveIds: ["dream-drift", "pillow-moonbeam", "secret-signal", "starrail-echo"],
    fieldSkillId: "secret-sense",
    portrait: moonpaperCranePortrait,
    wild: true,
  },
  {
    speciesId: "gearpaw-cub",
    name: "Gearpaw Cub",
    category: "齒輪小熊",
    personality: "會用齒輪肉球修小機關,但常常把自己轉到頭暈。",
    elements: ["crystal", "spark"],
    rarity: "uncommon",
    favoriteSnack: "warm-cocoa-gem",
    growthStages: ["Gearpaw Cub", "Gearpaw Tinker", "Gearpaw Guardian"],
    moveIds: ["clockwork-tap", "crystal-brace", "zip-spark"],
    learnableMoveIds: ["clockwork-tap", "crystal-brace", "zip-spark", "hearth-guard"],
    fieldSkillId: "crystal-push",
    portrait: gearpawCubPortrait,
    wild: true,
  },
  {
    speciesId: "snowdrift-penguin",
    name: "Snowdrift Penguin",
    category: "雪鈴企鵝",
    personality: "走路搖搖晃晃,卻能在冰面上畫出漂亮的鈴鐺路線。",
    elements: ["tide", "crystal"],
    rarity: "common",
    favoriteSnack: "moon-milk-puff",
    growthStages: ["Snowdrift Chick", "Snowdrift Penguin", "Bellice Penguin"],
    moveIds: ["bubble-pat", "pearl-splash", "crystal-brace"],
    learnableMoveIds: ["bubble-pat", "pearl-splash", "crystal-brace", "seal-slide"],
    fieldSkillId: "soft-float",
    portrait: snowdriftPenguinPortrait,
    wild: true,
  },
  {
    speciesId: "lantern-newt",
    name: "Lantern Newt",
    category: "燈籠蠑螈",
    personality: "肚子像小燈籠一樣發亮,會陪怕黑的夥伴走夜路。",
    elements: ["light", "ember"],
    rarity: "uncommon",
    favoriteSnack: "warm-cocoa-gem",
    growthStages: ["Lantern Newt", "Lanterncrest Newt", "Hearthlight Newt"],
    moveIds: ["tiny-flash", "warm-puff", "brave-bump"],
    learnableMoveIds: ["tiny-flash", "warm-puff", "brave-bump", "sugar-sparkle"],
    fieldSkillId: "light-trail",
    portrait: lanternNewtPortrait,
    wild: true,
  },
  {
    speciesId: "cloverwhirl-snail",
    name: "Cloverwhirl Snail",
    category: "幸運旋蝸",
    personality: "慢慢爬過的地方會長出幸運草,殼裡常飄出夢雲。",
    elements: ["leaf", "dream"],
    rarity: "common",
    favoriteSnack: "clover-macaron",
    growthStages: ["Cloverwhirl Snail", "Cloverwhirl Shellsage", "Dreamclover Snail"],
    moveIds: ["clover-patch", "spore-puff", "nap-song"],
    learnableMoveIds: ["clover-patch", "spore-puff", "nap-song", "dream-drift"],
    fieldSkillId: "secret-sense",
    portrait: cloverwhirlSnailPortrait,
    wild: true,
  },
  {
    speciesId: "prismbell-gryphon",
    name: "Prismbell Gryphon",
    category: "稜鐘幼獅鷲",
    personality: "胸前的稜鐘會回應勇氣,是星軌觀測台的小守衛。",
    elements: ["light", "star"],
    rarity: "warden",
    favoriteSnack: "starberry-cookie",
    growthStages: ["Prismbell Cub", "Prismbell Gryphon", "Prismbell Warden"],
    moveIds: ["tiny-flash", "bell-chime", "starrail-echo"],
    learnableMoveIds: ["tiny-flash", "bell-chime", "starrail-echo", "aurora-parade"],
    fieldSkillId: "light-trail",
    portrait: prismbellGryphonPortrait,
    wild: true,
  },
  {
    speciesId: "silent-bellheart",
    name: "Silent Bellheart",
    category: "靜鐘之心",
    personality: "Crystal Bell 深處的沉默守護者,正在重新學習信任。",
    elements: ["light", "crystal"],
    rarity: "mythling",
    favoriteSnack: "warm-cocoa-gem",
    growthStages: ["Silent Bellheart"],
    moveIds: ["silent-bell", "heart-crystal", "aurora-parade"],
    learnableMoveIds: ["silent-bell", "heart-crystal", "aurora-parade", "hearth-crystal-roar"],
    fieldSkillId: "light-trail",
    portrait: silentBellheartPortrait,
    wild: false,
  },
];

const STARTER_SPECIES_IDS = new Set(["lumi", "momo", "pico", "nibi"]);

export const STARTER_SPECIES = WA_CREATURES.filter((c) => STARTER_SPECIES_IDS.has(c.speciesId));
export const WILD_SPECIES = WA_CREATURES.filter((c) => c.wild);

export function starterById(id: string): CreatureSpecies | undefined {
  return STARTER_SPECIES.find((c) => c.speciesId === id);
}

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

export function starterSnackBundle(species: CreatureSpecies): Record<string, number> {
  const fallbackSnack =
    species.favoriteSnack === "starberry-cookie" ? "clover-macaron" : "starberry-cookie";
  return {
    [species.favoriteSnack]: 2,
    [fallbackSnack]: 2,
  };
}

export function movesForElements(elements: WonderAcademyElement[]): string[] {
  const matched = Object.values(WONDER_ACADEMY_MOVES)
    .filter((m) => elements.includes(m.element))
    .map((m) => m.id);
  return matched.length > 0 ? matched.slice(0, 4) : ["tiny-flash"];
}

export function fieldSkillForElements(elements: WonderAcademyElement[]): string {
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

function knownMoveIds(ids: string[]): string[] {
  return ids.filter((id) => !!WONDER_ACADEMY_MOVES[id]).slice(0, 4);
}

function validEquippedMoveIds(owned: OwnedCreature, species: CreatureSpecies): string[] {
  const pool = learnablePool(species);
  const defaultMoveIds = new Set(defaultEquipped(species));
  return knownMoveIds(owned.equippedMoveIds ?? [])
    .filter((moveId) => {
      const poolIndex = pool.indexOf(moveId);
      if (poolIndex < 0) return false;
      return defaultMoveIds.has(moveId) || owned.level >= moveUnlockLevel(poolIndex);
    });
}

export function toCombatant(owned: OwnedCreature): BattleCombatant {
  const species = speciesById(owned.speciesId);
  const elements = species?.elements ?? ["light"];
  const equippedMoveIds = species ? validEquippedMoveIds(owned, species) : [];
  const defaultMoveIds = species ? knownMoveIds(defaultEquipped(species)) : ["tiny-flash"];
  const moveIds =
    equippedMoveIds.length > 0
      ? equippedMoveIds
      : defaultMoveIds.length > 0 ? defaultMoveIds : ["tiny-flash"];
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
