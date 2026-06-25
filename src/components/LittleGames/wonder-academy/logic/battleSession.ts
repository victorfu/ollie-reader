import type { WonderAcademyRarity } from "../../../../types/wonderAcademy";
import type { BattleCombatant } from "./battleLogic";
import { isFainted, isSleepy, performMove } from "./battleLogic";
import type { Rng } from "./rng";
import { attemptCatch } from "./catchLogic";

export type BattleOutcome = "ongoing" | "won" | "caught" | "fled" | "lost";

export type BattleEvent =
  | { kind: "playerMove"; moveId: string; damage: number; effectiveness: number }
  | { kind: "wildMove"; moveId: string; damage: number; effectiveness: number }
  | { kind: "wildSleepy" }
  | { kind: "playerFainted"; ownedId: string }
  | { kind: "switch"; toOwnedId: string }
  | { kind: "catchAttempt"; chance: number; caught: boolean }
  | { kind: "outcome"; outcome: BattleOutcome };

export type WildInfo = {
  combatant: BattleCombatant;
  rarity: WonderAcademyRarity;
  favoriteSnack: string;
};

export type BattleSession = {
  active: BattleCombatant;
  bench: BattleCombatant[];
  wild: BattleCombatant;
  wildRarity: WonderAcademyRarity;
  wildFavoriteSnack: string;
  turn: number;
  outcome: BattleOutcome;
  log: BattleEvent[];
};

export function startBattle(
  team: BattleCombatant[],
  wild: WildInfo,
): BattleSession {
  if (team.length === 0) {
    throw new Error("startBattle: team must not be empty");
  }
  return {
    active: team[0],
    bench: team.slice(1),
    wild: wild.combatant,
    wildRarity: wild.rarity,
    wildFavoriteSnack: wild.favoriteSnack,
    turn: 1,
    outcome: "ongoing",
    log: [],
  };
}

export function enemyRetaliate(session: BattleSession): BattleSession {
  if (session.outcome !== "ongoing") return session;

  const moveId = session.wild.moveIds[0];
  const { defender, damage, effectiveness } = performMove(
    session.wild,
    session.active,
    moveId,
  );
  const log: BattleEvent[] = [
    ...session.log,
    { kind: "wildMove", moveId, damage, effectiveness },
  ];

  if (!isFainted(defender)) {
    return { ...session, active: defender, log };
  }

  log.push({ kind: "playerFainted", ownedId: defender.ownedId });

  if (session.bench.length > 0) {
    const [next, ...rest] = session.bench;
    log.push({ kind: "switch", toOwnedId: next.ownedId });
    return { ...session, active: next, bench: rest, log };
  }

  log.push({ kind: "outcome", outcome: "lost" });
  return { ...session, active: defender, outcome: "lost", log };
}

export function playerAttack(
  session: BattleSession,
  moveId: string,
): BattleSession {
  if (session.outcome !== "ongoing") return session;

  const { defender, damage, effectiveness } = performMove(
    session.active,
    session.wild,
    moveId,
  );
  const log: BattleEvent[] = [
    ...session.log,
    { kind: "playerMove", moveId, damage, effectiveness },
  ];

  if (isFainted(defender)) {
    log.push({ kind: "outcome", outcome: "won" });
    return { ...session, wild: defender, outcome: "won", log };
  }

  if (isSleepy(defender)) {
    log.push({ kind: "wildSleepy" });
  }

  const afterPlayer: BattleSession = { ...session, wild: defender, log };
  const afterEnemy = enemyRetaliate(afterPlayer);
  return { ...afterEnemy, turn: afterEnemy.turn + 1 };
}

export function playerCatch(
  session: BattleSession,
  treatTier: number,
  isFavorite: boolean,
  rng: Rng,
): BattleSession {
  if (session.outcome !== "ongoing") return session;

  const { caught, chance } = attemptCatch(
    {
      hpRatio: session.wild.hp / session.wild.maxHp,
      rarity: session.wildRarity,
      treatTier,
      isFavoriteSnack: isFavorite,
    },
    rng,
  );
  const log: BattleEvent[] = [
    ...session.log,
    { kind: "catchAttempt", chance, caught },
  ];

  if (caught) {
    log.push({ kind: "outcome", outcome: "caught" });
    return { ...session, outcome: "caught", log };
  }

  const afterEnemy = enemyRetaliate({ ...session, log });
  return { ...afterEnemy, turn: afterEnemy.turn + 1 };
}

export function playerSwitch(
  session: BattleSession,
  ownedId: string,
): BattleSession {
  if (session.outcome !== "ongoing") return session;

  const index = session.bench.findIndex((m) => m.ownedId === ownedId);
  if (index === -1) return session;

  const next = session.bench[index];
  const bench = [
    ...session.bench.slice(0, index),
    ...session.bench.slice(index + 1),
    session.active,
  ];
  const log: BattleEvent[] = [
    ...session.log,
    { kind: "switch", toOwnedId: next.ownedId },
  ];

  const afterEnemy = enemyRetaliate({ ...session, active: next, bench, log });
  return { ...afterEnemy, turn: afterEnemy.turn + 1 };
}

export function playerFlee(session: BattleSession): BattleSession {
  if (session.outcome !== "ongoing") return session;
  return {
    ...session,
    outcome: "fled",
    log: [...session.log, { kind: "outcome", outcome: "fled" }],
  };
}
