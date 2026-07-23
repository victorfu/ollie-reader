import { describe, expect, it } from "vitest";
import {
  getEarlyStartBonus,
  getInvestedCost,
  getPlaceCost,
  getSellRefund,
  getUpgradeCost,
} from "./economy";
import { EARLY_START_BONUS_PER_SECOND, RARITY_TIERS } from "../constants";
import type { Pet } from "../types";

function makePet(rarity: Pet["rarity"]): Pet {
  return {
    id: "test-pet",
    name: "Test Pet",
    nameZh: "測試寵物",
    elements: ["spark"],
    rarity,
    sprite: "test.png",
  };
}

describe("tower costs", () => {
  it("charges the rarity tier price to place a tower", () => {
    expect(getPlaceCost(makePet("common"))).toBe(RARITY_TIERS.common.cost);
    expect(getPlaceCost(makePet("warden"))).toBe(RARITY_TIERS.warden.cost);
  });

  it("makes each upgrade step cost more than the last", () => {
    const pet = makePet("uncommon");

    expect(getUpgradeCost(pet, 2)).toBeGreaterThan(getUpgradeCost(pet, 1));
  });

  it("sums placement plus every upgrade into the invested cost", () => {
    const pet = makePet("rare");

    expect(getInvestedCost(pet, 1)).toBe(getPlaceCost(pet));
    expect(getInvestedCost(pet, 2)).toBe(
      getPlaceCost(pet) + getUpgradeCost(pet, 1),
    );
    expect(getInvestedCost(pet, 3)).toBe(
      getPlaceCost(pet) + getUpgradeCost(pet, 1) + getUpgradeCost(pet, 2),
    );
  });
});

describe("getSellRefund", () => {
  it("refunds a fraction of what was invested, never all of it", () => {
    const pet = makePet("rare");

    for (const level of [1, 2, 3] as const) {
      const invested = getInvestedCost(pet, level);
      const refund = getSellRefund(pet, level);

      expect(refund).toBeLessThan(invested);
      expect(refund).toBeGreaterThan(0);
    }
  });

  it("refunds more for a more upgraded tower", () => {
    const pet = makePet("common");

    expect(getSellRefund(pet, 3)).toBeGreaterThan(getSellRefund(pet, 1));
  });

  it("returns a whole number of frosting", () => {
    expect(Number.isInteger(getSellRefund(makePet("mythling"), 2))).toBe(true);
  });
});

describe("getEarlyStartBonus", () => {
  it("pays out proportionally to the prep time skipped", () => {
    expect(getEarlyStartBonus(10_000)).toBe(10 * EARLY_START_BONUS_PER_SECOND);
    expect(getEarlyStartBonus(20_000)).toBe(
      2 * getEarlyStartBonus(10_000),
    );
  });

  it("pays nothing once prep time has run out", () => {
    expect(getEarlyStartBonus(0)).toBe(0);
    expect(getEarlyStartBonus(-500)).toBe(0);
  });

  it("returns a whole number of frosting", () => {
    expect(Number.isInteger(getEarlyStartBonus(7_777))).toBe(true);
  });
});
