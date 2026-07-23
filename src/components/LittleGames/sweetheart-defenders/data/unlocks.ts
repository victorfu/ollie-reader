import { LEVELS } from "./levels";
import { STARTER_PET_IDS, getPet } from "./pets";
import type { Stars } from "../engine/progress";

/** 一隻寵物是怎麼拿到的，圖鑑用來顯示解鎖條件。 */
export type UnlockSource =
  | { kind: "starter" }
  | { kind: "clear"; levelId: string; levelName: string }
  | { kind: "threeStars"; levelId: string; levelName: string }
  | { kind: "future" };

/**
 * 打完一關該解鎖哪些寵物。
 *
 * 解鎖表就寫在 LevelSpec 裡，加關卡就只是加資料——這裡只負責查表，
 * 不藏任何規則。
 */
export function petsUnlockedBy(levelId: string, stars: Stars): string[] {
  const level = LEVELS.find((candidate) => candidate.id === levelId);
  if (!level || stars <= 0) return [];

  return stars >= 3
    ? [...level.unlocksOnClear, ...level.unlocksOnThreeStars]
    : [...level.unlocksOnClear];
}

/** 全部關卡都三星之後，總共能用到的寵物。 */
export function allObtainablePetIds(): string[] {
  const ids = new Set(STARTER_PET_IDS);
  for (const level of LEVELS) {
    for (const id of level.unlocksOnClear) ids.add(id);
    for (const id of level.unlocksOnThreeStars) ids.add(id);
  }
  return [...ids];
}

/** 圖鑑用：這隻寵物要怎麼拿到。 */
export function unlockSourceFor(petId: string): UnlockSource {
  if (STARTER_PET_IDS.includes(petId)) return { kind: "starter" };

  for (const level of LEVELS) {
    if (level.unlocksOnClear.includes(petId)) {
      return { kind: "clear", levelId: level.id, levelName: level.nameZh };
    }
    if (level.unlocksOnThreeStars.includes(petId)) {
      return { kind: "threeStars", levelId: level.id, levelName: level.nameZh };
    }
  }

  return { kind: "future" };
}

export function describeUnlockSource(source: UnlockSource): string {
  switch (source.kind) {
    case "starter":
      return "一開始就有";
    case "clear":
      return `通關「${source.levelName}」`;
    case "threeStars":
      return `「${source.levelName}」拿三顆星`;
    case "future":
      return "之後的章節開放";
  }
}

/**
 * 解鎖表指到不存在的寵物就等於玩家永遠拿不到，而且不會有任何錯誤訊息。
 * 這個檢查給測試用，讓打錯的 id 在 CI 就被抓出來。
 */
export function findBrokenUnlockIds(): string[] {
  return allObtainablePetIds().filter((id) => getPet(id) === undefined);
}
