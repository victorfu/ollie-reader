// Shared walkable-scene map data for the Wonder Academy forest. Used by both the
// reducer (collision + per-tile effects in WonderAcademyCollector) and the
// Kaplay renderer (ExploreSceneKaplay) so the two never drift apart.

export type SceneState = {
  x: number;
  y: number;
  opened: string[];
  message: string | null;
};

// T=tree(blocked) P=path G=grass C=chest N=npc X=exit S=start W=warden
export const SCENE_MAP = [
  "TTTTTTTTT",
  "TPPPGPCWT",
  "TPTTPTTPT",
  "TGPPSPPGT",
  "TPTTPTTNT",
  "TPCPGPPPT",
  "TTTTXTTTT",
];
export const SCENE_W = SCENE_MAP[0].length;
export const SCENE_H = SCENE_MAP.length;

export function tileAt(x: number, y: number): string | null {
  if (y < 0 || y >= SCENE_H || x < 0 || x >= SCENE_W) return null;
  return SCENE_MAP[y][x];
}

export function sceneStart(): { x: number; y: number } {
  for (let y = 0; y < SCENE_H; y += 1) {
    const x = SCENE_MAP[y].indexOf("S");
    if (x >= 0) return { x, y };
  }
  return { x: 1, y: 1 };
}
