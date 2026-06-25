// Generic tile helpers for the Wonder Academy exploration maps. The maps
// themselves live in wonderAcademyRegions.ts; these operate on whichever map a
// region supplies. Shared by the reducer (collision + tile effects) and the
// Kaplay renderer.
//
// Tile legend: T=tree(blocked) P=path G=grass C=chest N=npc X=exit S=start W=warden

export type SceneState = {
  x: number;
  y: number;
  opened: string[];
  message: string | null;
};

export function tileAt(map: string[], x: number, y: number): string | null {
  if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return null;
  return map[y][x];
}

export function findStart(map: string[]): { x: number; y: number } {
  for (let y = 0; y < map.length; y += 1) {
    const x = map[y].indexOf("S");
    if (x >= 0) return { x, y };
  }
  return { x: 1, y: 1 };
}
