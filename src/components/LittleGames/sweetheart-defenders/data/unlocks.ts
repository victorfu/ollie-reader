import { LEVELS } from "./levels";
import type { Stars } from "../engine/progress";

/**
 * 關卡是一條線，不是一張任你挑的地圖清單：第一關永遠開著，之後每一關都要
 * 前一關先通關（至少一顆星）才會開。
 *
 * 角色的取得不在這裡——那由扭蛋機負責（見 useTowerRoster.ts）。關卡給的是
 * 扭蛋代幣，玩家自己拿去抽想要的角色。
 */
export function isLevelUnlocked(
  levelId: string,
  levelStars: Record<string, Stars>,
): boolean {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  if (index < 0) return false;
  if (index === 0) return true;

  return (levelStars[LEVELS[index - 1].id] ?? 0) > 0;
}

/** 玩家接下來該打哪一關：第一個還沒通關的。全破的話回最後一關。 */
export function nextPlayableLevelId(levelStars: Record<string, Stars>): string {
  const next = LEVELS.find((level) => (levelStars[level.id] ?? 0) === 0);
  return (next ?? LEVELS[LEVELS.length - 1]).id;
}
