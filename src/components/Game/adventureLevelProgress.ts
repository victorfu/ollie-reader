import { LEVEL_EXP_TABLE } from "../../services/gameProgressService";

export interface AdventureLevelProgress {
  isMaxLevel: boolean;
  expInCurrentLevel: number;
  expNeededForLevel: number;
  percentage: number;
}

export function getAdventureLevelProgress(
  level: number,
  totalExp: number,
): AdventureLevelProgress {
  const normalizedLevel = Math.min(
    Math.max(Math.trunc(level), 1),
    LEVEL_EXP_TABLE.length,
  );
  const currentLevelExp = LEVEL_EXP_TABLE[normalizedLevel - 1] ?? 0;
  const isMaxLevel = normalizedLevel >= LEVEL_EXP_TABLE.length;

  if (isMaxLevel) {
    return {
      isMaxLevel: true,
      expInCurrentLevel: Math.max(0, totalExp - currentLevelExp),
      expNeededForLevel: 0,
      percentage: 100,
    };
  }

  const nextLevelExp = LEVEL_EXP_TABLE[normalizedLevel];
  const expNeededForLevel = nextLevelExp - currentLevelExp;
  const expInCurrentLevel = Math.max(0, totalExp - currentLevelExp);
  return {
    isMaxLevel: false,
    expInCurrentLevel,
    expNeededForLevel,
    percentage: Math.min(
      Math.max((expInCurrentLevel / expNeededForLevel) * 100, 0),
      100,
    ),
  };
}
