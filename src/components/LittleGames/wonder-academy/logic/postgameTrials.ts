import {
  mergeMaterials,
  type MaterialInventory,
} from "./charms";

export type PostgameTrial = {
  id: string;
  name: string;
  speciesId: string;
  level: number;
  stardust: number;
  firstWinBonus: number;
  materials: MaterialInventory;
};

export const POSTGAME_TRIALS: PostgameTrial[] = [
  {
    id: "warden-rematch",
    name: "守關連戰",
    speciesId: "clockbell-tanuki",
    level: 44,
    stardust: 35,
    firstWinBonus: 25,
    materials: { "clock-spring": 2, "bell-shard": 1 },
  },
  {
    id: "bellheart-trial",
    name: "靜鐘之心試煉",
    speciesId: "silent-bellheart",
    level: 50,
    stardust: 50,
    firstWinBonus: 40,
    materials: { "sugar-crystal": 2, "bell-shard": 2 },
  },
];

export function postgameTrialById(id: string): PostgameTrial | undefined {
  return POSTGAME_TRIALS.find((trial) => trial.id === id);
}

export function isPostgameUnlocked(
  regionIds: readonly string[],
  wardensDefeated: readonly string[],
): boolean {
  return regionIds.length > 0 && regionIds.every((id) => wardensDefeated.includes(id));
}

export function awardTrialWin({
  trialId,
  stardust,
  materials,
  trialWins,
}: {
  trialId: string;
  stardust: number;
  materials: MaterialInventory;
  trialWins: Record<string, number>;
}): {
  won: boolean;
  stardust: number;
  materials: MaterialInventory;
  trialWins: Record<string, number>;
} {
  const trial = postgameTrialById(trialId);
  if (!trial) {
    return { won: false, stardust, materials, trialWins };
  }
  const previousWins = trialWins[trial.id] ?? 0;
  return {
    won: true,
    stardust: stardust + trial.stardust + (previousWins === 0 ? trial.firstWinBonus : 0),
    materials: mergeMaterials(materials, trial.materials),
    trialWins: { ...trialWins, [trial.id]: previousWins + 1 },
  };
}
