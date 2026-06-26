// Field skills are passive exploration perks granted by the creatures currently
// on the team. A creature contributes its species' fieldSkillId; the aggregate
// of all the team's skills produces the perks applied during exploration.
//
// Pure logic — given the list of active field-skill ids, return the perks.

export type FieldPerks = {
  /** Multiplier on the base grass-encounter chance. */
  encounterMultiplier: number;
  /** Multiplier on the encounter weight of non-common (rarer) species. */
  rareWeightBonus: number;
  /** Extra chest loot rolls. */
  lootRollBonus: number;
  /** Flat bonus stardust added when a chest is opened. */
  chestStardustBonus: number;
  /** Extra snacks received from an NPC. */
  npcSnackBonus: number;
};

export const NO_PERKS: FieldPerks = {
  encounterMultiplier: 1,
  rareWeightBonus: 1,
  lootRollBonus: 0,
  chestStardustBonus: 0,
  npcSnackBonus: 0,
};

export function teamFieldPerks(fieldSkillIds: readonly string[]): FieldPerks {
  const has = (id: string) => fieldSkillIds.includes(id);
  return {
    encounterMultiplier: has("light-trail") ? 1.5 : 1,
    rareWeightBonus: has("secret-sense") ? 2 : 1,
    lootRollBonus: has("secret-sense") ? 1 : 0,
    chestStardustBonus: has("crystal-push") ? 10 : 0,
    npcSnackBonus: has("soft-float") ? 1 : 0,
  };
}
