export const MAX_LEVEL = 50;

// XP required to advance FROM `level` to `level + 1`.
export function xpToNext(level: number): number {
  return 10 + level * 10;
}

export type LevelUpResult = {
  level: number;
  xp: number;
  levelsGained: number;
};

// Adds `amount` XP to a creature at (level, xp toward next). Rolls over as
// many levels as the amount allows; at MAX_LEVEL no further XP is stored.
export function gainXp(
  level: number,
  xp: number,
  amount: number,
): LevelUpResult {
  let currentLevel = level;
  let currentXp = xp + amount;
  let levelsGained = 0;

  while (currentLevel < MAX_LEVEL && currentXp >= xpToNext(currentLevel)) {
    currentXp -= xpToNext(currentLevel);
    currentLevel += 1;
    levelsGained += 1;
  }

  if (currentLevel >= MAX_LEVEL) {
    currentLevel = MAX_LEVEL;
    currentXp = 0;
  }

  return { level: currentLevel, xp: currentXp, levelsGained };
}
