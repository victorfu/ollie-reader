import { describe, expect, it } from "vitest";
import {
  allObtainablePetIds,
  describeUnlockSource,
  findBrokenUnlockIds,
  isLevelUnlocked,
  nextPlayableLevelId,
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

/**
 * 關卡是一條線：一次只開放下一關，不是一整片任你挑。
 * 規則寫在這裡而不是畫面裡，才測得到。
 */
describe("level gating", () => {
  const [first, second, third] = LEVELS;

  it("always leaves the first level open", () => {
    expect(isLevelUnlocked(first.id, {})).toBe(true);
  });

  it("keeps every later level shut until the one before it is cleared", () => {
    expect(isLevelUnlocked(second.id, {})).toBe(false);
    expect(isLevelUnlocked(third.id, {})).toBe(false);
  });

  it("opens exactly one more level per clear", () => {
    const afterFirst = { [first.id]: 1 as const };

    expect(isLevelUnlocked(second.id, afterFirst)).toBe(true);
    expect(isLevelUnlocked(third.id, afterFirst)).toBe(false);
  });

  it("treats a failed run as not cleared", () => {
    expect(isLevelUnlocked(second.id, { [first.id]: 0 })).toBe(false);
  });

  it("does not need three stars to move on", () => {
    expect(isLevelUnlocked(second.id, { [first.id]: 1 })).toBe(true);
  });

  it("refuses to unlock a level that does not exist", () => {
    expect(isLevelUnlocked("not-a-level", {})).toBe(false);
  });
});

describe("nextPlayableLevelId", () => {
  it("points at the first level on a fresh save", () => {
    expect(nextPlayableLevelId({})).toBe(LEVELS[0].id);
  });

  it("moves on as levels get cleared", () => {
    expect(nextPlayableLevelId({ [LEVELS[0].id]: 2 })).toBe(LEVELS[1].id);
  });

  it("skips ahead past levels already beaten", () => {
    const stars = Object.fromEntries(
      LEVELS.slice(0, 3).map((level) => [level.id, 3 as const]),
    );

    expect(nextPlayableLevelId(stars)).toBe(LEVELS[3].id);
  });

  it("stays on the last level once everything is beaten", () => {
    const stars = Object.fromEntries(
      LEVELS.map((level) => [level.id, 3 as const]),
    );

    expect(nextPlayableLevelId(stars)).toBe(LEVELS[LEVELS.length - 1].id);
  });
});
