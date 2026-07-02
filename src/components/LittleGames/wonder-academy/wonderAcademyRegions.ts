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
  "TPPGPCPNT",
  "TPOPTGPPT",
  "TGPSFPGPT",
  "TPTTTPTPT",
  "TCPGPGPPT",
  "TTTTXTTTT",
];

const CLOCKTOWER_MAP = [
  "TTTTTTTTT",
  "TPNPGPCPT",
  "TPTOTTTPT",
  "TGPFSPGPT",
  "TPTTTPTNT",
  "TCPGPGPPT",
  "TTTTXTTTT",
];

const SUGARCLOUD_MAP = [
  "TTTTTTTTT",
  "TGPCPNPPT",
  "TPOPGTTPT",
  "TPPSFPGPT",
  "TPTTTPTPT",
  "TCPGPGPPT",
  "TTTTXTTTT",
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
    nodes: SUGARCLOUD_NODES,
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
