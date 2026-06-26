import type { WonderAcademyElement } from "../../../../types/wonderAcademy";
import {
  getMoveById,
  type MoveDef,
} from "../../../../data/wonderAcademyMoves";
import { getEffectivenessAgainst } from "./typeChart";

export type BattleCombatant = {
  ownedId: string;
  speciesId: string;
  name: string;
  elements: WonderAcademyElement[];
  level: number;
  maxHp: number;
  hp: number;
  attack: number;
  moveIds: string[];
  /** Turns left asleep (skips its turn while > 0). */
  asleep?: number;
  /** Rare colour variant. */
  shiny?: boolean;
};

export const SLEEPY_HP_RATIO = 0.25;

export function computeDamage(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  move: MoveDef,
): { damage: number; effectiveness: number } {
  const effectiveness = getEffectivenessAgainst(move.element, defender.elements);
  const base = move.power + Math.floor(attacker.attack / 2);
  const damage = Math.max(1, Math.round(base * effectiveness));
  return { damage, effectiveness };
}

export function applyDamage(
  combatant: BattleCombatant,
  amount: number,
): BattleCombatant {
  return { ...combatant, hp: Math.max(0, combatant.hp - amount) };
}

export function performMove(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  moveId: string,
): { defender: BattleCombatant; damage: number; effectiveness: number } {
  const move = getMoveById(moveId);
  if (!move) throw new Error(`Unknown move: ${moveId}`);
  const { damage, effectiveness } = computeDamage(attacker, defender, move);
  return { defender: applyDamage(defender, damage), damage, effectiveness };
}

export function isFainted(combatant: BattleCombatant): boolean {
  return combatant.hp <= 0;
}

export function isSleepy(combatant: BattleCombatant): boolean {
  return combatant.hp > 0 && combatant.hp <= combatant.maxHp * SLEEPY_HP_RATIO;
}

export function isAsleep(combatant: BattleCombatant): boolean {
  return (combatant.asleep ?? 0) > 0;
}
