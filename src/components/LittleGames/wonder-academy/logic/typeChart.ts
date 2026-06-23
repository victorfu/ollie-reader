import type { WonderAcademyElement } from "../../../../types/wonderAcademy";

// Cycle: each element is 2x against the next two, 0.5x against the previous two.
// spark -> tide -> ember -> leaf -> crystal -> dream -> star -> light -> (spark)
const STRONG_AGAINST: Record<WonderAcademyElement, WonderAcademyElement[]> = {
  spark: ["tide", "ember"],
  tide: ["ember", "leaf"],
  ember: ["leaf", "crystal"],
  leaf: ["crystal", "dream"],
  crystal: ["dream", "star"],
  dream: ["star", "light"],
  star: ["light", "spark"],
  light: ["spark", "tide"],
};

export function getEffectiveness(
  attacking: WonderAcademyElement,
  defending: WonderAcademyElement,
): number {
  if (STRONG_AGAINST[attacking].includes(defending)) return 2;
  if (STRONG_AGAINST[defending].includes(attacking)) return 0.5;
  return 1;
}

export function getEffectivenessAgainst(
  attacking: WonderAcademyElement,
  defenderElements: WonderAcademyElement[],
): number {
  if (defenderElements.length === 0) return 1;
  return Math.max(
    ...defenderElements.map((element) => getEffectiveness(attacking, element)),
  );
}
