import { describe, expect, it } from "vitest";
import { getMoveById } from "../../../data/wonderAcademyMoves";
import { EVOLUTION_LEVELS } from "./logic/evolution";
import {
  FIELD_SKILLS,
  STARTER_SPECIES,
  WA_CREATURES,
  learnablePool,
  makeCustomCreature,
  starterById,
  starterSnackBundle,
  toCombatant,
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

  it("looks up only canonical starter species by id", () => {
    expect(starterById("lumi")?.name).toBe("Lumi");
    expect(starterById("mossmew")).toBeUndefined();
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

  it("ships a P1/P2 roster with wild, warden, and mythling coverage", () => {
    const expandedSpeciesIds = [
      "glimmerbun",
      "tideshell-otter",
      "embercap-salamander",
      "crystalmoth",
      "sugarquill-hedgehog",
      "moonpaper-crane",
      "gearpaw-cub",
      "snowdrift-penguin",
      "lantern-newt",
      "cloverwhirl-snail",
      "prismbell-gryphon",
    ];

    expect(WA_CREATURES).toHaveLength(24);
    expect(WA_CREATURES.map((species) => species.speciesId)).toEqual(
      expect.arrayContaining([
        "mossmew",
        "sparkleaf-fawn",
        "pearlwhisker-seal",
        "clockbell-tanuki",
        "marshmallow-maestro",
        "aurora-alpaca",
        "comet-kitsune",
        "pillowmoon-ram",
        "silent-bellheart",
        ...expandedSpeciesIds,
      ]),
    );

    const builtInEncounterSpecies = WA_CREATURES.filter((species) => species.wild);
    expect(builtInEncounterSpecies.map((species) => species.speciesId)).toEqual(
      expect.arrayContaining(expandedSpeciesIds),
    );
    expect(builtInEncounterSpecies.length).toBeGreaterThanOrEqual(19);
    expect(Array.from(new Set(WA_CREATURES.map((species) => species.rarity)))).toEqual(
      expect.arrayContaining(["common", "uncommon", "rare", "warden", "mythling"]),
    );
  });

  it("uses a dedicated portrait for every built-in species", () => {
    const portraitToSpecies = new Map<string, string>();

    for (const species of WA_CREATURES) {
      const previousSpeciesId = portraitToSpecies.get(species.portrait);
      expect(
        previousSpeciesId,
        `${species.speciesId} reuses the portrait from ${previousSpeciesId}`,
      ).toBeUndefined();
      portraitToSpecies.set(species.portrait, species.speciesId);
    }
  });

  it("keeps every built-in species inside the four-stage evolution cap", () => {
    for (const species of WA_CREATURES) {
      expect(
        species.growthStages.length,
        `${species.speciesId} exceeds the four-stage cap`,
      ).toBeLessThanOrEqual(4);
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

  it("starts every starter with its favorite snack", () => {
    for (const species of STARTER_SPECIES) {
      const snacks = starterSnackBundle(species);
      const total = Object.values(snacks).reduce((sum, qty) => sum + qty, 0);

      expect(snacks[species.favoriteSnack], `${species.speciesId} needs favorite snacks`).toBeGreaterThanOrEqual(2);
      expect(total, `${species.speciesId} should keep the starter bundle small`).toBe(4);
    }
  });

  it("keeps Lumi's old starter snacks while giving Momo moon milk puffs", () => {
    const lumi = STARTER_SPECIES.find((species) => species.speciesId === "lumi");
    const momo = STARTER_SPECIES.find((species) => species.speciesId === "momo");

    expect(lumi).toBeDefined();
    expect(momo).toBeDefined();
    expect(starterSnackBundle(lumi!)).toEqual({
      "starberry-cookie": 2,
      "clover-macaron": 2,
    });
    expect(starterSnackBundle(momo!)).toEqual({
      "moon-milk-puff": 2,
      "starberry-cookie": 2,
    });
  });

  it("keeps valid equipped moves when building a battle combatant", () => {
    expect(toCombatant({
      ownedId: "owned-lumi",
      speciesId: "lumi",
      nickname: "Lumi",
      level: 5,
      xp: 0,
      bond: 0,
      stage: 0,
      equippedMoveIds: ["zip-spark", "tiny-flash"],
    }).moveIds).toEqual(["zip-spark", "tiny-flash"]);
  });

  it("repairs unknown equipped moves before battle", () => {
    expect(toCombatant({
      ownedId: "owned-lumi",
      speciesId: "lumi",
      nickname: "Lumi",
      level: 5,
      xp: 0,
      bond: 0,
      stage: 0,
      equippedMoveIds: ["missing-move"],
    }).moveIds).toEqual(["tiny-flash", "zip-spark", "wink-feint", "starstep-dash"]);
  });

  it("repairs equipped moves from another species before battle", () => {
    expect(toCombatant({
      ownedId: "owned-lumi",
      speciesId: "lumi",
      nickname: "Lumi",
      level: 9,
      xp: 0,
      bond: 0,
      stage: 0,
      equippedMoveIds: ["bubble-pat"],
    }).moveIds).toEqual(["tiny-flash", "zip-spark", "wink-feint", "starstep-dash"]);
  });

  it("repairs locked high-tier equipped moves before battle", () => {
    expect(toCombatant({
      ownedId: "owned-lumi",
      speciesId: "lumi",
      nickname: "Lumi",
      level: 1,
      xp: 0,
      bond: 0,
      stage: 0,
      equippedMoveIds: ["aurora-parade"],
    }).moveIds).toEqual(["tiny-flash", "zip-spark", "wink-feint", "starstep-dash"]);
  });

  it("preserves default loadout moves for low-level creatures", () => {
    expect(toCombatant({
      ownedId: "owned-lumi",
      speciesId: "lumi",
      nickname: "Lumi",
      level: 1,
      xp: 0,
      bond: 0,
      stage: 0,
      equippedMoveIds: ["zip-spark", "wink-feint"],
    }).moveIds).toEqual(["zip-spark", "wink-feint"]);
  });
});
