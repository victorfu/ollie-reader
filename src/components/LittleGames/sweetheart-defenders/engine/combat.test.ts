import { describe, expect, it } from "vitest";
import { computeDamage, getTowerStats, getTrait } from "./combat";
import { ARCHETYPE_BASE } from "../data/elements";
import { TRAIT_BASE } from "../data/traits";
import { LEVEL_POWER, RARITY_TIERS } from "../constants";
import { ELEMENTS, type TowerCharacter } from "../types";

function makeCharacter(overrides: Partial<TowerCharacter> = {}): TowerCharacter {
  return {
    id: "test-character",
    name: "Test Character",
    nameZh: "測試角色",
    // 預設給雙元素，副元素選 crystal（碎甲）——碎甲只在命中時生效，不會動到
    // 基礎數值，所以數值測試不用扣掉特性加成。
    elements: ["spark", "crystal"],
    rarity: "common",
    sprite: "test.png",
    ...overrides,
  };
}

describe("getTowerStats", () => {
  it("picks the archetype from the primary element", () => {
    expect(getTowerStats(makeCharacter({ elements: ["crystal", "spark"] }), 1).archetype).toBe(
      "cannon",
    );
    expect(getTowerStats(makeCharacter({ elements: ["star"] }), 1).archetype).toBe(
      "cheer",
    );
  });

  it("scales damage by rarity at level 1", () => {
    const common = getTowerStats(makeCharacter({ rarity: "common" }), 1);
    const mythling = getTowerStats(makeCharacter({ rarity: "mythling" }), 1);

    expect(common.damage).toBeCloseTo(ARCHETYPE_BASE.rapid.damage, 6);
    expect(mythling.damage).toBeCloseTo(
      ARCHETYPE_BASE.rapid.damage * RARITY_TIERS.mythling.power,
      6,
    );
  });

  it("scales damage by level on top of rarity", () => {
    const level3 = getTowerStats(makeCharacter({ rarity: "rare" }), 3);

    expect(level3.damage).toBeCloseTo(
      ARCHETYPE_BASE.rapid.damage * RARITY_TIERS.rare.power * LEVEL_POWER[2],
      6,
    );
  });

  it("shortens the cooldown as the tower levels up", () => {
    const level1 = getTowerStats(makeCharacter(), 1);
    const level3 = getTowerStats(makeCharacter(), 3);

    expect(level3.cooldownMs).toBeLessThan(level1.cooldownMs);
  });

  it("keeps cheer towers at zero cooldown instead of dividing by zero", () => {
    const cheer = getTowerStats(makeCharacter({ elements: ["star"] }), 3);

    expect(cheer.cooldownMs).toBe(0);
    expect(cheer.damage).toBe(0);
    expect(cheer.cheerBonus).toBeGreaterThan(ARCHETYPE_BASE.cheer.cheerBonus);
  });

  it("never lets a special effect run away with levels", () => {
    const syrup = getTowerStats(makeCharacter({ elements: ["tide"] }), 3);
    const cannon = getTowerStats(makeCharacter({ elements: ["crystal"] }), 3);

    expect(syrup.slowFactor).toBeLessThanOrEqual(0.6);
    expect(cannon.armorPierce).toBeLessThanOrEqual(0.9);
  });

  it("leaves effects at zero for archetypes that do not have them", () => {
    const rapid = getTowerStats(makeCharacter({ elements: ["spark"] }), 3);

    expect(rapid.slowFactor).toBe(0);
    expect(rapid.stunChance).toBe(0);
    expect(rapid.armorPierce).toBe(0);
    expect(rapid.splashRadius).toBe(0);
  });
});

describe("traits from the secondary element", () => {
  it("gives each secondary element its own trait", () => {
    expect(getTrait(makeCharacter({ elements: ["spark", "tide"] }))).toBe("chill");
    expect(getTrait(makeCharacter({ elements: ["spark", "leaf"] }))).toBe("toxin");
    expect(getTrait(makeCharacter({ elements: ["spark", "crystal"] }))).toBe("shred");
    expect(getTrait(makeCharacter({ elements: ["crystal", "spark"] }))).toBe("chain");
  });

  it("falls back to 純粹 for single-element pets", () => {
    expect(getTrait(makeCharacter({ elements: ["spark"] }))).toBe("pure");
  });

  it("pays single-element pets back with extra damage", () => {
    const pure = getTowerStats(makeCharacter({ elements: ["spark"] }), 1);
    const dual = getTowerStats(makeCharacter({ elements: ["spark", "crystal"] }), 1);

    expect(pure.trait).toBe("pure");
    expect(pure.damage).toBeCloseTo(
      dual.damage * (1 + TRAIT_BASE.pure.damageBonus),
      6,
    );
  });

  it("extends range for 專注 but not for other traits", () => {
    const focus = getTowerStats(makeCharacter({ elements: ["spark", "light"] }), 1);
    const plain = getTowerStats(makeCharacter({ elements: ["spark", "crystal"] }), 1);

    expect(focus.trait).toBe("focus");
    expect(focus.range).toBeCloseTo(
      plain.range * (1 + TRAIT_BASE.focus.rangeBonus),
      6,
    );
  });

  it("scales trait strength with rarity and level", () => {
    const common1 = getTowerStats(
      makeCharacter({ elements: ["spark", "leaf"], rarity: "common" }),
      1,
    );
    const common3 = getTowerStats(
      makeCharacter({ elements: ["spark", "leaf"], rarity: "common" }),
      3,
    );
    const rare1 = getTowerStats(
      makeCharacter({ elements: ["spark", "leaf"], rarity: "rare" }),
      1,
    );

    expect(common1.traitPower).toBe(1);
    expect(common3.traitPower).toBeGreaterThan(common1.traitPower);
    expect(rare1.traitPower).toBeGreaterThan(common1.traitPower);
  });

  it("pairs every archetype with its own attack style", () => {
    const styles = new Set(
      ELEMENTS.map(
        (element) => getTowerStats(makeCharacter({ elements: [element] }), 1).attackStyle,
      ),
    );

    // 8 種打法就該有 8 種看得出差別的攻擊視覺。
    expect(styles.size).toBe(8);
  });
});

describe("computeDamage", () => {
  const stats = getTowerStats(makeCharacter({ elements: ["spark"] }), 1);

  it("doubles damage against an element the tower counters", () => {
    // spark 剋 tide
    const damage = computeDamage({
      stats,
      secondaryElements: [],
      enemyElement: "tide",
      enemyArmor: 0,
    });

    expect(damage).toBeCloseTo(stats.damage * 2, 6);
  });

  it("halves damage against an element that counters the tower", () => {
    // star 剋 spark
    const damage = computeDamage({
      stats,
      secondaryElements: [],
      enemyElement: "star",
      enemyArmor: 0,
    });

    expect(damage).toBeCloseTo(stats.damage * 0.5, 6);
  });

  it("adds a bonus when a secondary element also counters the enemy", () => {
    const plain = computeDamage({
      stats,
      secondaryElements: [],
      enemyElement: "leaf",
      enemyArmor: 0,
    });
    // tide 剋 leaf
    const boosted = computeDamage({
      stats,
      secondaryElements: ["tide"],
      enemyElement: "leaf",
      enemyArmor: 0,
    });

    expect(boosted).toBeGreaterThan(plain);
    expect(boosted).toBeCloseTo(plain * 1.2, 6);
  });

  it("ignores a secondary element that has no advantage", () => {
    const plain = computeDamage({
      stats,
      secondaryElements: [],
      enemyElement: "leaf",
      enemyArmor: 0,
    });
    const withUselessSecondary = computeDamage({
      stats,
      secondaryElements: ["star"],
      enemyElement: "leaf",
      enemyArmor: 0,
    });

    expect(withUselessSecondary).toBeCloseTo(plain, 6);
  });

  it("reduces damage by enemy armor", () => {
    const damage = computeDamage({
      stats,
      secondaryElements: [],
      enemyElement: "leaf",
      enemyArmor: 0.5,
    });

    expect(damage).toBeCloseTo(stats.damage * 0.5, 6);
  });

  it("lets armor piercing cut through most of the armor", () => {
    const cannon = getTowerStats(makeCharacter({ elements: ["crystal"] }), 1);
    const damage = computeDamage({
      stats: cannon,
      secondaryElements: [],
      enemyElement: "spark",
      enemyArmor: 0.5,
    });

    // 0.6 pierce -> 有效護甲 0.5 * 0.4 = 0.2
    expect(damage).toBeCloseTo(cannon.damage * 0.8, 6);
  });
});
