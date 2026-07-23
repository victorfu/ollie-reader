import {
  ARCHETYPE_BASE,
  ARCHETYPE_BY_ELEMENT,
  getEffectiveness,
} from "../data/elements";
import { LEVEL_POWER, RARITY_TIERS, SECONDARY_ELEMENT_BONUS } from "../constants";
import type { Element, Pet, TowerStats } from "../types";

/** 每升一級，除了整體倍率之外還會小幅加成的部分。 */
const PER_LEVEL = {
  range: 0.08,
  attackSpeed: 0.1,
  splash: 0.1,
  slow: 0.07,
  stun: 0.08,
  pierce: 0.1,
  cheer: 0.1,
} as const;

/**
 * 一隻寵物在某個等級下的實際塔數值。
 * 主元素決定打法，稀有度與等級決定強度。
 */
export function getTowerStats(pet: Pet, level: 1 | 2 | 3): TowerStats {
  const element = pet.elements[0];
  const archetype = ARCHETYPE_BY_ELEMENT[element];
  const base = ARCHETYPE_BASE[archetype];
  const steps = level - 1;
  const power = RARITY_TIERS[pet.rarity].power * LEVEL_POWER[steps];

  return {
    archetype,
    element,
    range: base.range * (1 + PER_LEVEL.range * steps),
    damage: base.damage * power,
    cooldownMs:
      base.cooldownMs === 0
        ? 0
        : base.cooldownMs / (1 + PER_LEVEL.attackSpeed * steps),
    splashRadius: base.splashRadius * (1 + PER_LEVEL.splash * steps),
    slowFactor:
      base.slowFactor === 0
        ? 0
        : Math.min(0.6, base.slowFactor + PER_LEVEL.slow * steps),
    stunChance:
      base.stunChance === 0
        ? 0
        : Math.min(0.6, base.stunChance + PER_LEVEL.stun * steps),
    armorPierce:
      base.armorPierce === 0
        ? 0
        : Math.min(0.9, base.armorPierce + PER_LEVEL.pierce * steps),
    cheerBonus:
      base.cheerBonus === 0 ? 0 : base.cheerBonus + PER_LEVEL.cheer * steps,
  };
}

/**
 * 一次攻擊實際造成的傷害。
 *
 * 主元素吃完整的克制倍率（2 / 1 / 0.5），副元素只在剛好克制對方時給一點加成，
 * 這樣雙元素寵物有優勢但不會讓單元素寵物完全沒得選。護甲最後才減。
 */
export function computeDamage(params: {
  stats: TowerStats;
  /** pet.elements.slice(1) */
  secondaryElements: Element[];
  enemyElement: Element;
  enemyArmor: number;
}): number {
  const { stats, secondaryElements, enemyElement, enemyArmor } = params;

  const effectiveness = getEffectiveness(stats.element, enemyElement);
  const hasSecondaryAdvantage = secondaryElements.some(
    (element) => getEffectiveness(element, enemyElement) > 1,
  );
  const secondaryBonus = hasSecondaryAdvantage ? SECONDARY_ELEMENT_BONUS : 0;
  const effectiveArmor = clamp01(enemyArmor * (1 - stats.armorPierce));

  return (
    stats.damage * effectiveness * (1 + secondaryBonus) * (1 - effectiveArmor)
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
