import { describe, expect, it } from "vitest";
import { getMoveById } from "../../../data/wonderAcademyMoves";
import { EVOLUTION_LEVELS } from "./logic/evolution";
import {
  FIELD_SKILLS,
  STARTER_SPECIES,
  WA_CREATURES,
  learnablePool,
  makeCustomCreature,
} from "./wonderAcademyCreatures";

describe("Wonder Academy creature registry", () => {
  it("gives every built-in species a valid field skill", () => {
    for (const species of WA_CREATURES) {
      expect(
        species.fieldSkillId,
        `${species.speciesId} should define a field skill`,
      ).toBeTruthy();
      expect(
        FIELD_SKILLS[species.fieldSkillId],
        `${species.speciesId} should use a known field skill`,
      ).toBeDefined();
    }
  });

  it("keeps starter field skills aligned with the canonical spec", () => {
    expect(
      Object.fromEntries(STARTER_SPECIES.map((species) => [species.speciesId, species.fieldSkillId])),
    ).toEqual({
      lumi: "light-trail",
      momo: "soft-float",
      pico: "secret-sense",
      nibi: "crystal-push",
    });
  });

  it("keeps species move references and evolution stages valid", () => {
    for (const species of WA_CREATURES) {
      expect(species.moveIds.length, `${species.speciesId} needs a battle move`).toBeGreaterThan(0);
      expect(
        species.growthStages.length,
        `${species.speciesId} exceeds fixed evolution thresholds`,
      ).toBeLessThanOrEqual(EVOLUTION_LEVELS.length + 1);

      for (const moveId of learnablePool(species)) {
        expect(getMoveById(moveId), `${species.speciesId} references missing move ${moveId}`).toBeDefined();
      }
    }
  });

  it("assigns deterministic field skills to custom creatures", () => {
    expect(makeCustomCreature({
      name: "Leaf Scout",
      portrait: "leaf.png",
      elements: ["leaf"],
      favoriteSnack: "clover-macaron",
      seed: 1,
    }).fieldSkillId).toBe("secret-sense");

    expect(makeCustomCreature({
      name: "Spark Friend",
      portrait: "spark.png",
      elements: ["spark"],
      favoriteSnack: "starberry-cookie",
      seed: 2,
    }).fieldSkillId).toBe("light-trail");

    expect(makeCustomCreature({
      name: "Default Friend",
      portrait: "default.png",
      elements: [],
      favoriteSnack: "starberry-cookie",
      seed: 3,
    }).fieldSkillId).toBe("light-trail");
  });
});
