import { describe, expect, it } from "vitest";
import {
  CHARM_DEFS,
  craftCharm,
  charmEffects,
  lootMaterialsForTier,
  mergeMaterials,
  normalizeActiveCharms,
  normalizeCharms,
  normalizeMaterials,
  toggleActiveCharm,
} from "./charms";

describe("Wonder Academy charms economy", () => {
  it("normalizes materials to known nonnegative integer ids", () => {
    expect(normalizeMaterials({
      "glow-petal": 2.9,
      "tide-glass": -3,
      "unknown": 10,
      "bell-shard": 1,
    })).toEqual({
      "glow-petal": 2,
      "bell-shard": 1,
    });
  });

  it("normalizes charms to known nonnegative integer ids", () => {
    expect(normalizeCharms({
      "lucky-lantern": 1,
      "treasure-ribbon": 2.8,
      "bad-charm": 99,
      "quiet-sneakers": -1,
    })).toEqual({
      "lucky-lantern": 1,
      "treasure-ribbon": 2,
    });
  });

  it("crafts a charm by spending stardust and materials", () => {
    const result = craftCharm({
      stardust: 50,
      materials: { "glow-petal": 3, "bell-shard": 1 },
      charms: {},
      charmId: "lucky-lantern",
    });

    expect(result.crafted).toBe(true);
    expect(result.stardust).toBe(20);
    expect(result.materials).toEqual({ "glow-petal": 1 });
    expect(result.charms).toEqual({ "lucky-lantern": 1 });
  });

  it("does not craft when requirements are missing", () => {
    const result = craftCharm({
      stardust: CHARM_DEFS["training-bell"].stardustCost - 1,
      materials: {},
      charms: {},
      charmId: "training-bell",
    });

    expect(result.crafted).toBe(false);
    expect(result.charms).toEqual({});
  });

  it("normalizes active charms to owned known charms and caps at two", () => {
    expect(normalizeActiveCharms(
      ["missing", "lucky-lantern", "lucky-lantern", "treasure-ribbon", "training-bell"],
      { "lucky-lantern": 1, "treasure-ribbon": 1, "training-bell": 1 },
    )).toEqual(["lucky-lantern", "treasure-ribbon"]);
  });

  it("toggles only owned charms and refuses a third active slot", () => {
    const charms = { "lucky-lantern": 1, "treasure-ribbon": 1, "training-bell": 1 };

    expect(toggleActiveCharm(["lucky-lantern"], charms, "lucky-lantern")).toEqual([]);
    expect(toggleActiveCharm([], charms, "missing")).toEqual([]);
    expect(toggleActiveCharm(["lucky-lantern", "treasure-ribbon"], charms, "training-bell")).toEqual([
      "lucky-lantern",
      "treasure-ribbon",
    ]);
  });

  it("aggregates active charm effects", () => {
    expect(charmEffects(["lucky-lantern", "treasure-ribbon", "training-bell"])).toEqual({
      encounterMultiplier: 1,
      rareWeightBonus: 1.35,
      lootRollBonus: 1,
      chestStardustBonus: 8,
      shinyBonus: 1 / 32,
      xpMultiplier: 1.25,
    });
  });

  it("maps deeper loot tiers to richer material bundles", () => {
    expect(lootMaterialsForTier(1)).toEqual({ "glow-petal": 1 });
    expect(lootMaterialsForTier(2)).toEqual({ "tide-glass": 1 });
    expect(lootMaterialsForTier(3)).toEqual({ "clock-spring": 1 });
    expect(lootMaterialsForTier(4)).toEqual({ "sugar-crystal": 1, "bell-shard": 1 });
  });

  it("merges material bundles without keeping zero values", () => {
    expect(mergeMaterials({ "glow-petal": 1 }, { "glow-petal": 2, "bell-shard": 1 })).toEqual({
      "glow-petal": 3,
      "bell-shard": 1,
    });
  });
});
