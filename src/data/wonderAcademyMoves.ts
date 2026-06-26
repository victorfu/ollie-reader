import type { WonderAcademyElement } from "../types/wonderAcademy";

export type MoveDef = {
  id: string;
  name: string;
  element: WonderAcademyElement;
  power: number;
  /** A lullaby move: can lull the target to sleep (skips its turns). */
  sleep?: boolean;
};

const move = (
  id: string,
  name: string,
  element: WonderAcademyElement,
  power: number,
  sleep = false,
): MoveDef => (sleep ? { id, name, element, power, sleep } : { id, name, element, power });

export const WONDER_ACADEMY_MOVES: Record<string, MoveDef> = {
  // Lumi — light / spark
  "tiny-flash": move("tiny-flash", "微光閃", "light", 6),
  "zip-spark": move("zip-spark", "電光衝", "spark", 9),
  "wink-feint": move("wink-feint", "眨眼佯攻", "spark", 5),
  "starstep-dash": move("starstep-dash", "星步衝刺", "light", 9),
  "aurora-parade": move("aurora-parade", "極光遊行", "light", 14),

  // Momo — dream / tide
  "bubble-pat": move("bubble-pat", "泡泡輕拍", "tide", 6),
  "cozy-shield": move("cozy-shield", "暖暖護盾", "tide", 4),
  "nap-song": move("nap-song", "搖籃小曲", "dream", 5, true),
  "moon-drizzle": move("moon-drizzle", "月光細雨", "tide", 9),
  "dreamcloud-haven": move("dreamcloud-haven", "夢雲庇護", "dream", 14, true),

  // Pico — star / leaf
  "leaf-wink": move("leaf-wink", "葉影眨眼", "leaf", 6),
  "stardust-peek": move("stardust-peek", "星塵窺探", "star", 6),
  "clover-patch": move("clover-patch", "幸運草叢", "leaf", 5),
  "secret-signal": move("secret-signal", "祕密信號", "star", 9),
  "wishbloom-spiral": move("wishbloom-spiral", "願花螺旋", "star", 14),

  // Nibi — ember / crystal
  "warm-puff": move("warm-puff", "暖暖噴氣", "ember", 6),
  "crystal-brace": move("crystal-brace", "晶石護身", "crystal", 4),
  "brave-bump": move("brave-bump", "勇氣撞擊", "ember", 7),
  "hearth-guard": move("hearth-guard", "爐心守衛", "crystal", 6),
  "hearth-crystal-roar": move("hearth-crystal-roar", "爐心晶吼", "ember", 14),

  // Wild creature moves
  "mossy-tackle": move("mossy-tackle", "苔蘚衝撞", "leaf", 6),
  "spore-puff": move("spore-puff", "孢子噴霧", "leaf", 5),
};

export function getMoveById(id: string): MoveDef | null {
  return WONDER_ACADEMY_MOVES[id] ?? null;
}
