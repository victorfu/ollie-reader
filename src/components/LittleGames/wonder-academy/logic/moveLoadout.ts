import { getMoveById } from "../../../../data/wonderAcademyMoves";
import {
  defaultEquipped,
  learnablePool,
  moveUnlockLevel,
  type CreatureSpecies,
  type OwnedCreature,
} from "../wonderAcademyCreatures";

const MAX_EQUIPPED_MOVES = 4;

export function equippedMovesFor(
  owned: OwnedCreature,
  species: CreatureSpecies | undefined,
): string[] {
  const moveIds =
    owned.equippedMoveIds && owned.equippedMoveIds.length > 0
      ? owned.equippedMoveIds
      : species ? defaultEquipped(species) : [];
  return moveIds.filter((moveId) => !!getMoveById(moveId)).slice(0, MAX_EQUIPPED_MOVES);
}

export function canEquipMoveForCreature(
  owned: OwnedCreature,
  species: CreatureSpecies | undefined,
  moveId: string,
): boolean {
  if (!species || !getMoveById(moveId)) return false;
  const poolIndex = learnablePool(species).indexOf(moveId);
  if (poolIndex < 0) return false;
  if (owned.level < moveUnlockLevel(poolIndex)) return false;

  const equipped = equippedMovesFor(owned, species);
  return !equipped.includes(moveId) && equipped.length < MAX_EQUIPPED_MOVES;
}

export function equipMoveForCreature(
  owned: OwnedCreature,
  species: CreatureSpecies | undefined,
  moveId: string,
): OwnedCreature {
  if (!canEquipMoveForCreature(owned, species, moveId)) return owned;
  return {
    ...owned,
    equippedMoveIds: [...equippedMovesFor(owned, species), moveId],
  };
}

export function unequipMoveForCreature(
  owned: OwnedCreature,
  species: CreatureSpecies | undefined,
  moveId: string,
): OwnedCreature {
  const equipped = equippedMovesFor(owned, species);
  if (equipped.length <= 1 || !equipped.includes(moveId)) return owned;
  return {
    ...owned,
    equippedMoveIds: equipped.filter((id) => id !== moveId),
  };
}
