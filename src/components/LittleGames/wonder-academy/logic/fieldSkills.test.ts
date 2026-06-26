import { describe, expect, it } from "vitest";
import { NO_PERKS, teamFieldPerks } from "./fieldSkills";

describe("teamFieldPerks", () => {
  it("returns neutral perks for an empty team", () => {
    expect(teamFieldPerks([])).toEqual(NO_PERKS);
  });

  it("light-trail raises the encounter multiplier", () => {
    expect(teamFieldPerks(["light-trail"]).encounterMultiplier).toBe(1.5);
  });

  it("secret-sense boosts rare weight and adds a loot roll", () => {
    const p = teamFieldPerks(["secret-sense"]);
    expect(p.rareWeightBonus).toBe(2);
    expect(p.lootRollBonus).toBe(1);
  });

  it("crystal-push adds chest stardust", () => {
    expect(teamFieldPerks(["crystal-push"]).chestStardustBonus).toBe(10);
  });

  it("soft-float adds an NPC snack", () => {
    expect(teamFieldPerks(["soft-float"]).npcSnackBonus).toBe(1);
  });

  it("stacks perks across multiple field skills on the team", () => {
    const p = teamFieldPerks(["light-trail", "secret-sense", "crystal-push", "soft-float"]);
    expect(p).toEqual({
      encounterMultiplier: 1.5,
      rareWeightBonus: 2,
      lootRollBonus: 1,
      chestStardustBonus: 10,
      npcSnackBonus: 1,
    });
  });

  it("ignores unknown field-skill ids", () => {
    expect(teamFieldPerks(["nope"])).toEqual(NO_PERKS);
  });
});
