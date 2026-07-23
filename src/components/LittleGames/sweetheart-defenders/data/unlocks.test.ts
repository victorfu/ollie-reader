import { describe, expect, it } from "vitest";
import {
  allObtainablePetIds,
  describeUnlockSource,
  findBrokenUnlockIds,
  petsUnlockedBy,
  unlockSourceFor,
} from "./unlocks";
import { LEVELS } from "./levels";
import { STARTER_PET_IDS } from "./pets";
import { getTowerStats, getTrait } from "../engine/combat";
import { PETS, getPet } from "./pets";

describe("unlock table integrity", () => {
  it("never points at a pet that does not exist", () => {
    expect(findBrokenUnlockIds()).toEqual([]);
  });

  it("never unlocks the same pet twice", () => {
    const all = [
      ...STARTER_PET_IDS,
      ...LEVELS.flatMap((level) => [
        ...level.unlocksOnClear,
        ...level.unlocksOnThreeStars,
      ]),
    ];

    expect(all).toHaveLength(new Set(all).size);
  });

  it("never re-unlocks a starter as a reward", () => {
    const rewards = LEVELS.flatMap((level) => [
      ...level.unlocksOnClear,
      ...level.unlocksOnThreeStars,
    ]);

    expect(rewards.filter((id) => STARTER_PET_IDS.includes(id))).toEqual([]);
  });
});

describe("petsUnlockedBy", () => {
  const first = LEVELS[0];

  it("gives nothing for a failed run", () => {
    expect(petsUnlockedBy(first.id, 0)).toEqual([]);
  });

  it("gives the clear rewards for one or two stars", () => {
    expect(petsUnlockedBy(first.id, 1)).toEqual(first.unlocksOnClear);
    expect(petsUnlockedBy(first.id, 2)).toEqual(first.unlocksOnClear);
  });

  it("adds the bonus rewards for three stars", () => {
    expect(petsUnlockedBy(first.id, 3)).toEqual([
      ...first.unlocksOnClear,
      ...first.unlocksOnThreeStars,
    ]);
  });

  it("gives nothing for an unknown level", () => {
    expect(petsUnlockedBy("not-a-level", 3)).toEqual([]);
  });
});

describe("unlockSourceFor", () => {
  it("labels starters, rewards and locked pets", () => {
    expect(unlockSourceFor(STARTER_PET_IDS[0])).toEqual({ kind: "starter" });
    expect(unlockSourceFor(LEVELS[0].unlocksOnClear[0]).kind).toBe("clear");
    expect(unlockSourceFor(LEVELS[0].unlocksOnThreeStars[0]).kind).toBe(
      "threeStars",
    );

    const locked = PETS.find(
      (pet) => !allObtainablePetIds().includes(pet.id),
    );
    expect(locked && unlockSourceFor(locked.id)).toEqual({ kind: "future" });
  });

  it("describes every source in Chinese", () => {
    for (const petId of PETS.map((pet) => pet.id)) {
      expect(describeUnlockSource(unlockSourceFor(petId))).not.toBe("");
    }
  });
});

describe("the pets a player can actually reach", () => {
  it("covers all eight archetypes once the first level is cleared", () => {
    const reachable = [
      ...STARTER_PET_IDS,
      ...LEVELS[0].unlocksOnClear,
      ...LEVELS[0].unlocksOnThreeStars,
    ];

    const archetypes = new Set(
      reachable.map(
        (id) => getTowerStats(getPet(id)!, 1).archetype,
      ),
    );

    expect(archetypes.size).toBe(8);
  });

  it("gives the starters a spread of traits rather than six of the same", () => {
    const traits = new Set(
      STARTER_PET_IDS.map((id) => getTrait(getPet(id)!)),
    );

    expect(traits.size).toBeGreaterThanOrEqual(5);
  });
});
