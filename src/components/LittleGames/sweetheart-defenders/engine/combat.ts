import {
  ARCHETYPE_BASE,
  ARCHETYPE_BY_ELEMENT,
  ATTACK_STYLE_BY_ARCHETYPE,
  getEffectiveness,
} from "../data/elements";
import { TRAIT_BASE, TRAIT_BY_SECONDARY_ELEMENT } from "../data/traits";
import { LEVEL_POWER, RARITY_TIERS, SECONDARY_ELEMENT_BONUS } from "../constants";
import { SPECIALISATIONS, type SpecPath } from "../data/specialisations";
import type {
  Element,
  TowerCharacter,
  TowerLevel,
  TowerStats,
  TowerTrait,
} from "../types";

/** 每升一級，除了整體倍率之外還會小幅加成的部分。 */
const PER_LEVEL = {
  range: 0.08,
  attackSpeed: 0.1,
  splash: 0.1,
  slow: 0.07,
  stun: 0.08,
  pierce: 0.1,
  cheer: 0.1,
  trait: 0.25,
} as const;

/** 一隻角色的特性：由副元素決定，沒有副元素就是「純粹」。 */
export function getTrait(pet: TowerCharacter): TowerTrait {
  const secondary = pet.elements[1];
  return secondary ? TRAIT_BY_SECONDARY_ELEMENT[secondary] : "pure";
}

/**
 * 一隻角色在某個等級下的實際塔數值。
 *
 * 主元素決定打法（rapid / sniper / cannon…），副元素決定特性（連鎖 / 毒液 /
 * 碎甲…），稀有度與等級決定強度。所以 8 種打法 × 8 種特性讓 48 隻角色幾乎
 * 每一隻手感都不一樣。
 */
export function getTowerStats(
  pet: TowerCharacter,
  level: TowerLevel,
  spec: SpecPath | null = null,
): TowerStats {
  const element = pet.elements[0];
  const archetype = ARCHETYPE_BY_ELEMENT[element];
  const base = ARCHETYPE_BASE[archetype];
  const steps = level - 1;
  const rarityPower = RARITY_TIERS[pet.rarity].power;
  const power = rarityPower * LEVEL_POWER[steps];

  const trait = getTrait(pet);
  const traitPower = rarityPower * (1 + PER_LEVEL.trait * steps);

  // 「純粹」與「專注」直接改基礎數值，其餘特性在命中時才生效。
  const pureBonus = trait === "pure" ? 1 + TRAIT_BASE.pure.damageBonus : 1;
  const focusRange = trait === "focus" ? 1 + TRAIT_BASE.focus.rangeBonus : 1;

  const base_ = {
    archetype,
    attackStyle: ATTACK_STYLE_BY_ARCHETYPE[archetype],
    element,
    trait,
    traitPower,
    range: base.range * (1 + PER_LEVEL.range * steps) * focusRange,
    damage: base.damage * power * pureBonus,
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
    extraTargets: 0,
  };

  return spec ? applySpecialisation(base_, spec) : base_;
}

/**
 * 套上第 4 級的專精。
 *
 * 專精只會改既有的欄位（外加 extraTargets），所以模擬層完全不需要知道
 * 「這座塔選了哪一條」——它拿到的還是一份普通的 TowerStats。
 */
function applySpecialisation(stats: TowerStats, path: SpecPath): TowerStats {
  const spec = SPECIALISATIONS[stats.archetype][path];

  return {
    ...stats,
    range: stats.range * (spec.range ?? 1),
    damage: stats.damage * (spec.damage ?? 1),
    cooldownMs: stats.cooldownMs * (spec.cooldown ?? 1),
    splashRadius: stats.splashRadius * (spec.splashRadius ?? 1),
    // 這幾個是比例，加算之後仍要夾在合理範圍內。
    slowFactor: Math.min(0.75, stats.slowFactor + (spec.slowFactor ?? 0)),
    stunChance: Math.min(0.7, stats.stunChance + (spec.stunChance ?? 0)),
    armorPierce: Math.min(0.95, stats.armorPierce + (spec.armorPierce ?? 0)),
    cheerBonus: stats.cheerBonus + (spec.cheerBonus ?? 0),
    extraTargets: spec.extraTargets ?? 0,
  };
}

/**
 * 一次攻擊實際造成的傷害。
 *
 * 主元素吃完整的克制倍率（2 / 1 / 0.5），副元素只在剛好克制對方時給一點加成，
 * 這樣雙元素角色有優勢但不會讓單元素角色完全沒得選。護甲最後才減，而且會扣掉
 * 被碎甲削掉的部分。
 */
export function computeDamage(params: {
  stats: TowerStats;
  /** pet.elements.slice(1) */
  secondaryElements: Element[];
  enemyElement: Element;
  enemyArmor: number;
  /** 被碎甲特性累積削掉的護甲 */
  enemyArmorShred?: number;
  enemyFlying?: boolean;
}): number {
  const {
    stats,
    secondaryElements,
    enemyElement,
    enemyArmor,
    enemyArmorShred = 0,
    enemyFlying = false,
  } = params;

  const effectiveness = getEffectiveness(stats.element, enemyElement);
  const hasSecondaryAdvantage = secondaryElements.some(
    (element) => getEffectiveness(element, enemyElement) > 1,
  );
  const secondaryBonus = hasSecondaryAdvantage ? SECONDARY_ELEMENT_BONUS : 0;

  // 專注特性專門對付飛在天上的怪。
  const flyingBonus =
    stats.trait === "focus" && enemyFlying
      ? 1 + TRAIT_BASE.focus.flyingBonus * stats.traitPower
      : 1;

  const remainingArmor = Math.max(0, enemyArmor - enemyArmorShred);
  const effectiveArmor = clamp01(remainingArmor * (1 - stats.armorPierce));

  return (
    stats.damage *
    effectiveness *
    (1 + secondaryBonus) *
    flyingBonus *
    (1 - effectiveArmor)
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
