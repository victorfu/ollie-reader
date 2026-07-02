// Explorable regions. Each region is a self-contained 7x9 tile map plus a theme
// (colours fed to the Kaplay renderer), an encounter level range and a warden.
// Beating a region's warden unlocks the next one.
//
// Tile legend (shared with sceneMap / ExploreSceneKaplay):
// T=tree(blocked) P=path G=grass C=chest N=npc X=exit S=start W=warden

import { FIELD_SKILLS, speciesById } from "./wonderAcademyCreatures";

export type RegionTheme = {
  /** Kaplay clear colour (RGB 0-255). */
  bg: [number, number, number];
  ground: string;
  grass: string;
  treeBase: string;
  canopyA: string;
  canopyB: string;
  trunk: string;
};

export type RegionNode = {
  id: string;
  label: string;
  kind: "explore" | "warden";
  /** Normalized position on the node map (0..1). */
  x: number;
  y: number;
  /** Node ids that must be cleared before this one unlocks. */
  requires: string[];
  /** Optional active-team field skill required for this node. */
  fieldSkillId?: string;
};

export type Region = {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  map: string[];
  theme: RegionTheme;
  minLevel: number;
  maxLevel: number;
  wardenSpeciesId: string;
  wardenLevel: number;
  /** Deeper regions drop more — bonus stardust per chest. */
  lootTier: number;
  /** Region-local catchable species pool used by grass encounters. */
  encounterSpeciesIds: string[];
  nodes: RegionNode[];
};

const FOREST_THEME: RegionTheme = {
  bg: [201, 228, 196],
  ground: "#ead9bd",
  grass: "#bfe39a",
  treeBase: "#79a667",
  canopyA: "#56974b",
  canopyB: "#6cb45e",
  trunk: "#8a5a32",
};

const TIDEGLASS_THEME: RegionTheme = {
  bg: [188, 225, 235],
  ground: "#e5d7bf",
  grass: "#91d3da",
  treeBase: "#5f9faa",
  canopyA: "#4f94a7",
  canopyB: "#75bed0",
  trunk: "#7a6b62",
};

const CLOCKTOWER_THEME: RegionTheme = {
  bg: [209, 200, 224],
  ground: "#d8c7a7",
  grass: "#b8b3cf",
  treeBase: "#8d86a8",
  canopyA: "#746f98",
  canopyB: "#9b95be",
  trunk: "#6f5a43",
};

const SUGARCLOUD_THEME: RegionTheme = {
  bg: [245, 214, 225],
  ground: "#f2d9b8",
  grass: "#f5b9d0",
  treeBase: "#d892b5",
  canopyA: "#e784ad",
  canopyB: "#f3a8c9",
  trunk: "#9c6274",
};

const SNOWBELL_THEME: RegionTheme = {
  bg: [220, 235, 245],
  ground: "#e8edf4",
  grass: "#b9d9ec",
  treeBase: "#9fb8ce",
  canopyA: "#c6d9e8",
  canopyB: "#e3eef8",
  trunk: "#7a8aa0",
};

const DREAMCLOUD_THEME: RegionTheme = {
  bg: [226, 214, 242],
  ground: "#e8d9f4",
  grass: "#d7c4ee",
  treeBase: "#b39ada",
  canopyA: "#a483d1",
  canopyB: "#c5abe8",
  trunk: "#71608f",
};

const STARRAIL_THEME: RegionTheme = {
  bg: [194, 204, 235],
  ground: "#d8d5ee",
  grass: "#b8c5f0",
  treeBase: "#7e8cc6",
  canopyA: "#6875b8",
  canopyB: "#95a1dc",
  trunk: "#555f91",
};

const CRYSTALBELL_THEME: RegionTheme = {
  bg: [215, 231, 235],
  ground: "#dfe8ed",
  grass: "#c4e6df",
  treeBase: "#9bd0c8",
  canopyA: "#78bcb8",
  canopyB: "#b4e2dd",
  trunk: "#63818a",
};

// Walkable scenes hold explore content (grass/chest/npc/exit) plus decorative
// tiles (F=flowers, walkable · O=pond, blocked). The warden is its own node on
// the node map, not a tile.
const SPARKLEAF_MAP = [
  "TTTTTTTTT",
  "TPPPGPCPT",
  "TPOTPTTPT",
  "TGPFSPPGT",
  "TPTTPTTNT",
  "TFCPGPPPT",
  "TTTTXTTTT",
];

const TIDEGLASS_MAP = [
  "TTTTTTTTT",
  "TPPGGPCXT",
  "TOOPOOGPT",
  "TGGSPPOTT",
  "TPOTTPGNT",
  "TCPPGPOTT",
  "TTTTTTTTT",
];

const CLOCKTOWER_MAP = [
  "TTTTTTTTT",
  "TPNTPPCXT",
  "TPPTTTGPT",
  "TPPSPGPNT",
  "TGTPTTTPT",
  "TCPPPGGPT",
  "TTTTTTTTT",
];

const SUGARCLOUD_MAP = [
  "TTTTTTTTT",
  "TGGPCPPXT",
  "TPOTGOTPT",
  "TPPSPPGNT",
  "TGOTTTGPT",
  "TCPPGPPPT",
  "TTTTTTTTT",
];

const SNOWBELL_MAP = [
  "TTTTTTTTT",
  "TPPPGPCXT",
  "TOTPTGOPT",
  "TGPSPPGNT",
  "TPTOTTPPT",
  "TCPGGPPPT",
  "TTTTTTTTT",
];

const DREAMCLOUD_MAP = [
  "TTTTTTTTT",
  "TGPFPNPXT",
  "TPOPGTGPT",
  "TFPSPPGOT",
  "TGPOTTPPT",
  "TCPPGGFPT",
  "TTTTTTTTT",
];

const STARRAIL_MAP = [
  "TTTTTTTTT",
  "TPGPCPPXT",
  "TGTTTPGPT",
  "TPPSPGPNT",
  "TGPGTTGPT",
  "TCPPPGFPT",
  "TTTTTTTTT",
];

const CRYSTALBELL_MAP = [
  "TTTTTTTTT",
  "TPGPCPNXT",
  "TOTGTTGPT",
  "TGPSPPGOT",
  "TPGTOTGPT",
  "TCPPPGPPT",
  "TTTTTTTTT",
];

const SPARKLEAF_NODES: RegionNode[] = [
  { id: "entry", label: "林間入口", kind: "explore", x: 0.18, y: 0.72, requires: [] },
  { id: "secret-garden", label: "祕密花圃", kind: "explore", x: 0.3, y: 0.18, requires: ["entry"], fieldSkillId: "secret-sense" },
  { id: "meadow", label: "螢火草原", kind: "explore", x: 0.42, y: 0.4, requires: ["entry"] },
  { id: "grove", label: "古樹空地", kind: "explore", x: 0.66, y: 0.66, requires: ["meadow"] },
  { id: "warden", label: "守關之地", kind: "warden", x: 0.86, y: 0.32, requires: ["grove"] },
];

const TIDEGLASS_NODES: RegionNode[] = [
  { id: "entry", label: "潮汐入口", kind: "explore", x: 0.16, y: 0.52, requires: [] },
  { id: "lagoon", label: "珍珠潟湖", kind: "explore", x: 0.38, y: 0.74, requires: ["entry"] },
  { id: "reef", label: "玻璃礁", kind: "explore", x: 0.62, y: 0.42, requires: ["lagoon"] },
  { id: "drift-cove", label: "漂浮小灣", kind: "explore", x: 0.43, y: 0.18, requires: ["entry"], fieldSkillId: "soft-float" },
  { id: "warden", label: "守關之地", kind: "warden", x: 0.86, y: 0.64, requires: ["reef"] },
];

const CLOCKTOWER_NODES: RegionNode[] = [
  { id: "entry", label: "宿舍門廊", kind: "explore", x: 0.16, y: 0.62, requires: [] },
  { id: "stair", label: "齒輪階梯", kind: "explore", x: 0.36, y: 0.36, requires: ["entry"] },
  { id: "attic", label: "星鐘閣樓", kind: "explore", x: 0.6, y: 0.64, requires: ["stair"] },
  { id: "gear-cache", label: "晶石機關房", kind: "explore", x: 0.58, y: 0.2, requires: ["stair"], fieldSkillId: "crystal-push" },
  { id: "warden", label: "守關之地", kind: "warden", x: 0.84, y: 0.38, requires: ["attic"] },
];

const SUGARCLOUD_NODES: RegionNode[] = [
  { id: "entry", label: "市集入口", kind: "explore", x: 0.14, y: 0.5, requires: [] },
  { id: "bakery", label: "糖雲烘焙街", kind: "explore", x: 0.36, y: 0.72, requires: ["entry"] },
  { id: "stage", label: "點心舞台", kind: "explore", x: 0.62, y: 0.44, requires: ["bakery"] },
  { id: "backstage", label: "祕密後台", kind: "explore", x: 0.42, y: 0.2, requires: ["entry"], fieldSkillId: "secret-sense" },
  { id: "warden", label: "守關之地", kind: "warden", x: 0.86, y: 0.68, requires: ["stage"] },
];

const SNOWBELL_NODES: RegionNode[] = [
  { id: "entry", label: "雪鈴山口", kind: "explore", x: 0.14, y: 0.6, requires: [] },
  { id: "drift", label: "霜雪小徑", kind: "explore", x: 0.34, y: 0.34, requires: ["entry"] },
  { id: "ridge", label: "極光山脊", kind: "explore", x: 0.62, y: 0.58, requires: ["drift"] },
  { id: "crystal-cave", label: "冰晶洞窟", kind: "explore", x: 0.5, y: 0.18, requires: ["drift"], fieldSkillId: "crystal-push" },
  { id: "warden", label: "守關之地", kind: "warden", x: 0.86, y: 0.36, requires: ["ridge"] },
];

const DREAMCLOUD_NODES: RegionNode[] = [
  { id: "entry", label: "夢雲入口", kind: "explore", x: 0.16, y: 0.5, requires: [] },
  { id: "lullaby", label: "搖籃雲床", kind: "explore", x: 0.34, y: 0.74, requires: ["entry"] },
  { id: "mirror-cloud", label: "月鏡雲台", kind: "explore", x: 0.62, y: 0.44, requires: ["lullaby"] },
  { id: "floating-nest", label: "漂浮夢巢", kind: "explore", x: 0.42, y: 0.2, requires: ["entry"], fieldSkillId: "soft-float" },
  { id: "warden", label: "守關之地", kind: "warden", x: 0.86, y: 0.7, requires: ["mirror-cloud"] },
];

const STARRAIL_NODES: RegionNode[] = [
  { id: "entry", label: "星軌月台", kind: "explore", x: 0.12, y: 0.56, requires: [] },
  { id: "dome", label: "觀測圓頂", kind: "explore", x: 0.36, y: 0.36, requires: ["entry"] },
  { id: "comet-ring", label: "彗星環道", kind: "explore", x: 0.64, y: 0.62, requires: ["dome"] },
  { id: "hidden-platform", label: "祕密星台", kind: "explore", x: 0.56, y: 0.18, requires: ["dome"], fieldSkillId: "secret-sense" },
  { id: "warden", label: "守關之地", kind: "warden", x: 0.86, y: 0.42, requires: ["comet-ring"] },
];

const CRYSTALBELL_NODES: RegionNode[] = [
  { id: "entry", label: "晶鐘入口", kind: "explore", x: 0.14, y: 0.58, requires: [] },
  { id: "resonance-hall", label: "共鳴長廊", kind: "explore", x: 0.36, y: 0.36, requires: ["entry"] },
  { id: "mirror-lake", label: "鏡晶湖", kind: "explore", x: 0.62, y: 0.66, requires: ["resonance-hall"] },
  { id: "bell-vine", label: "鈴藤密室", kind: "explore", x: 0.48, y: 0.18, requires: ["entry"], fieldSkillId: "light-trail" },
  { id: "warden", label: "守關之地", kind: "warden", x: 0.86, y: 0.34, requires: ["mirror-lake"] },
];

export const REGIONS: Region[] = [
  {
    id: "sparkleaf",
    name: "星葉森林",
    subtitle: "適合 Lv.2–6 · 入門",
    badge: "🌿",
    map: SPARKLEAF_MAP,
    theme: FOREST_THEME,
    minLevel: 2,
    maxLevel: 6,
    wardenSpeciesId: "sparkleaf-fawn",
    wardenLevel: 12,
    lootTier: 1,
    encounterSpeciesIds: [
      "mossmew",
      "sparkleaf-fawn",
      "glimmerbun",
      "cloverwhirl-snail",
      "dewdrop-sprout",
      "acorn-sprite",
    ],
    nodes: SPARKLEAF_NODES,
  },
  {
    id: "tideglass",
    name: "玻璃海岸",
    subtitle: "適合 Lv.8–14 · 潮汐",
    badge: "🌊",
    map: TIDEGLASS_MAP,
    theme: TIDEGLASS_THEME,
    minLevel: 8,
    maxLevel: 14,
    wardenSpeciesId: "pearlwhisker-seal",
    wardenLevel: 20,
    lootTier: 2,
    encounterSpeciesIds: [
      "pearlwhisker-seal",
      "tideshell-otter",
      "bubblefin-pony",
      "coralpuff-turtle",
      "driftpearl-crab",
      "quartz-koi",
    ],
    nodes: TIDEGLASS_NODES,
  },
  {
    id: "clocktower",
    name: "鐘塔宿舍",
    subtitle: "適合 Lv.14–22 · 機關",
    badge: "🕰️",
    map: CLOCKTOWER_MAP,
    theme: CLOCKTOWER_THEME,
    minLevel: 14,
    maxLevel: 22,
    wardenSpeciesId: "clockbell-tanuki",
    wardenLevel: 30,
    lootTier: 3,
    encounterSpeciesIds: [
      "clockbell-tanuki",
      "gearpaw-cub",
      "crystalmoth",
      "ticktock-sparrow",
      "brassbutton-mole",
      "keyring-ferret",
    ],
    nodes: CLOCKTOWER_NODES,
  },
  {
    id: "sugarcloud",
    name: "糖雲市集",
    subtitle: "適合 Lv.22–32 · 點心",
    badge: "🍬",
    map: SUGARCLOUD_MAP,
    theme: SUGARCLOUD_THEME,
    minLevel: 22,
    maxLevel: 32,
    wardenSpeciesId: "marshmallow-maestro",
    wardenLevel: 40,
    lootTier: 4,
    encounterSpeciesIds: [
      "marshmallow-maestro",
      "sugarquill-hedgehog",
      "embercap-salamander",
      "syrupwing-bat",
      "gumdrop-goat",
      "cinnamon-imp",
    ],
    nodes: SUGARCLOUD_NODES,
  },
  {
    id: "snowbell",
    name: "雪鈴山脊",
    subtitle: "適合 Lv.32–42 · 霜雪",
    badge: "❄️",
    map: SNOWBELL_MAP,
    theme: SNOWBELL_THEME,
    minLevel: 32,
    maxLevel: 42,
    wardenSpeciesId: "aurora-alpaca",
    wardenLevel: 50,
    lootTier: 5,
    encounterSpeciesIds: [
      "aurora-alpaca",
      "snowdrift-penguin",
      "lantern-newt",
      "frostbell-hare",
      "icicle-pup",
      "cocoa-yak",
    ],
    nodes: SNOWBELL_NODES,
  },
  {
    id: "dreamcloud",
    name: "夢雲祭典",
    subtitle: "適合 Lv.42–52 · 夢境",
    badge: "🌙",
    map: DREAMCLOUD_MAP,
    theme: DREAMCLOUD_THEME,
    minLevel: 42,
    maxLevel: 52,
    wardenSpeciesId: "pillowmoon-ram",
    wardenLevel: 60,
    lootTier: 6,
    encounterSpeciesIds: [
      "pillowmoon-ram",
      "moonpaper-crane",
      "lullaby-jelly",
      "dreamcap-baku",
      "blanket-bat",
      "cloverwhirl-snail",
    ],
    nodes: DREAMCLOUD_NODES,
  },
  {
    id: "starrail",
    name: "星軌觀測台",
    subtitle: "適合 Lv.52–62 · 星空",
    badge: "🔭",
    map: STARRAIL_MAP,
    theme: STARRAIL_THEME,
    minLevel: 52,
    maxLevel: 62,
    wardenSpeciesId: "comet-kitsune",
    wardenLevel: 70,
    lootTier: 7,
    encounterSpeciesIds: [
      "comet-kitsune",
      "prismbell-gryphon",
      "stardial-tortoise",
      "meteor-marmoset",
      "nebula-lynx",
      "crystalmoth",
    ],
    nodes: STARRAIL_NODES,
  },
  {
    id: "crystalbell",
    name: "晶鐘核心",
    subtitle: "適合 Lv.62–72 · 共鳴",
    badge: "🔔",
    map: CRYSTALBELL_MAP,
    theme: CRYSTALBELL_THEME,
    minLevel: 62,
    maxLevel: 72,
    wardenSpeciesId: "silent-bellheart",
    wardenLevel: 80,
    lootTier: 8,
    encounterSpeciesIds: [
      "bellvine-serpent",
      "mirrorpaw-cat",
      "quartz-koi",
      "chimewing-swan",
      "aurora-alpaca",
      "prismbell-gryphon",
    ],
    nodes: CRYSTALBELL_NODES,
  },
];

export const FIRST_REGION = REGIONS[0];

export function regionById(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}

/** A region is unlocked when the previous region's warden has been beaten. */
export function isRegionUnlocked(index: number, wardensDefeated: string[]): boolean {
  if (index <= 0) return true;
  return wardensDefeated.includes(REGIONS[index - 1].id);
}

/** Globally-unique key for a node's cleared state. */
export function nodeKey(regionId: string, nodeId: string): string {
  return `${regionId}:${nodeId}`;
}

/** A node is unlocked once all the nodes it requires have been cleared. */
export function isNodeUnlocked(
  node: RegionNode,
  regionId: string,
  clearedNodes: string[],
  fieldSkillIds: readonly string[] = [],
): boolean {
  const prerequisitesMet = node.requires.every((rid) => clearedNodes.includes(nodeKey(regionId, rid)));
  const fieldSkillMet = !node.fieldSkillId || fieldSkillIds.includes(node.fieldSkillId);
  return prerequisitesMet && fieldSkillMet;
}

export function nodeUnlockHint(
  node: RegionNode,
  region: Region,
  clearedNodes: string[],
  fieldSkillIds: readonly string[] = [],
): string | null {
  const missing = node.requires.filter((rid) => !clearedNodes.includes(nodeKey(region.id, rid)));
  if (missing.length > 0) {
    const labels = missing.map((rid) => region.nodes.find((candidate) => candidate.id === rid)?.label ?? rid);
    return `先完成「${labels.join("、")}」`;
  }

  if (node.fieldSkillId && !fieldSkillIds.includes(node.fieldSkillId)) {
    const skill = FIELD_SKILLS[node.fieldSkillId];
    return `需要「${skill?.name ?? node.fieldSkillId}」探索能力`;
  }

  return null;
}

export const VALID_REGION_TILES = new Set(["T", "P", "G", "C", "N", "X", "S", "W", "F", "O"]);

export function regionValidationErrors(region: Region): string[] {
  const errors: string[] = [];
  const prefix = `${region.id}:`;

  const width = region.map[0]?.length ?? 0;
  let startCount = 0;
  let exitCount = 0;

  if (region.map.length === 0) {
    errors.push(`${prefix} map must have at least one row`);
  }

  region.map.forEach((row, y) => {
    if (row.length !== width) {
      errors.push(`${prefix} map row ${y} has width ${row.length}, expected ${width}`);
    }

    Array.from(row).forEach((tile, x) => {
      if (!VALID_REGION_TILES.has(tile)) {
        errors.push(`${prefix} unknown tile '${tile}' at ${x},${y}`);
      }
      if (tile === "S") startCount += 1;
      if (tile === "X") exitCount += 1;
    });
  });

  if (startCount !== 1) {
    errors.push(`${prefix} expected exactly one start tile S, found ${startCount}`);
  }
  if (exitCount < 1) {
    errors.push(`${prefix} expected at least one exit tile X`);
  }
  if (region.minLevel > region.maxLevel) {
    errors.push(`${prefix} minLevel ${region.minLevel} exceeds maxLevel ${region.maxLevel}`);
  }
  if (region.wardenLevel < region.maxLevel) {
    errors.push(`${prefix} wardenLevel ${region.wardenLevel} is below maxLevel ${region.maxLevel}`);
  }
  if (!speciesById(region.wardenSpeciesId)) {
    errors.push(`${prefix} unknown warden species '${region.wardenSpeciesId}'`);
  }
  if (region.encounterSpeciesIds.length === 0) {
    errors.push(`${prefix} encounterSpeciesIds must not be empty`);
  }
  const encounterIds = new Set<string>();
  for (const speciesId of region.encounterSpeciesIds) {
    if (encounterIds.has(speciesId)) {
      errors.push(`${prefix} duplicate encounter species '${speciesId}'`);
    }
    encounterIds.add(speciesId);
    const species = speciesById(speciesId);
    if (!species) {
      errors.push(`${prefix} unknown encounter species '${speciesId}'`);
    } else if (!species.wild) {
      errors.push(`${prefix} encounter species '${speciesId}' is not catchable`);
    }
  }

  const ids = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const node of region.nodes) {
    if (ids.has(node.id)) duplicateIds.add(node.id);
    ids.add(node.id);
  }
  for (const id of duplicateIds) {
    errors.push(`${prefix} duplicate node id '${id}'`);
  }

  let wardenCount = 0;
  for (const node of region.nodes) {
    if (node.kind === "warden") wardenCount += 1;
    if (node.x < 0 || node.x > 1) {
      errors.push(`${prefix} node '${node.id}' x must be between 0 and 1`);
    }
    if (node.y < 0 || node.y > 1) {
      errors.push(`${prefix} node '${node.id}' y must be between 0 and 1`);
    }
    for (const requiredId of node.requires) {
      if (!ids.has(requiredId)) {
        errors.push(`${prefix} node '${node.id}' requires unknown node '${requiredId}'`);
      }
      if (requiredId === node.id) {
        errors.push(`${prefix} node '${node.id}' cannot require itself`);
      }
    }
    if (node.fieldSkillId && !FIELD_SKILLS[node.fieldSkillId]) {
      errors.push(`${prefix} node '${node.id}' requires unknown field skill '${node.fieldSkillId}'`);
    }
  }
  if (wardenCount !== 1) {
    errors.push(`${prefix} expected exactly one warden node, found ${wardenCount}`);
  }

  return errors;
}
