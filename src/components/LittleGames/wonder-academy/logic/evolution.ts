// Level required to evolve OUT OF stage `index` (0-based).
// A four-stage line has three transitions.
export const EVOLUTION_LEVELS = [12, 24, 36];

export function canEvolve(
  currentStage: number,
  level: number,
  totalStages: number,
): boolean {
  if (currentStage >= totalStages - 1) return false;
  const threshold = EVOLUTION_LEVELS[currentStage];
  if (threshold === undefined) return false;
  return level >= threshold;
}

export function evolve(currentStage: number, totalStages: number): number {
  return Math.min(currentStage + 1, totalStages - 1);
}
