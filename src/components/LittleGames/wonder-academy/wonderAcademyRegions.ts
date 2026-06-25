// Explorable regions. Each region is a self-contained 7x9 tile map plus a theme
// (colours fed to the Kaplay renderer), an encounter level range and a warden.
// Beating a region's warden unlocks the next one.
//
// Tile legend (shared with sceneMap / ExploreSceneKaplay):
// T=tree(blocked) P=path G=grass C=chest N=npc X=exit S=start W=warden

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

const GLIMMER_THEME: RegionTheme = {
  bg: [188, 201, 230],
  ground: "#d7dcef",
  grass: "#a9d6df",
  treeBase: "#6f8fb4",
  canopyA: "#5f7fb0",
  canopyB: "#7ba6d2",
  trunk: "#6b5a7a",
};

const SPARKLEAF_MAP = [
  "TTTTTTTTT",
  "TPPPGPCWT",
  "TPTTPTTPT",
  "TGPPSPPGT",
  "TPTTPTTNT",
  "TPCPGPPPT",
  "TTTTXTTTT",
];

const GLIMMER_MAP = [
  "TTTTTTTTT",
  "TGPCPGPNT",
  "TPTPTTTPT",
  "TPPSPPGPT",
  "TPTTTPTPT",
  "TCPGPPPWT",
  "TTTTXTTTT",
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
  },
  {
    id: "glimmer",
    name: "微光林海",
    subtitle: "適合 Lv.8–14 · 進階",
    badge: "🌌",
    map: GLIMMER_MAP,
    theme: GLIMMER_THEME,
    minLevel: 8,
    maxLevel: 14,
    wardenSpeciesId: "sparkleaf-fawn",
    wardenLevel: 20,
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
