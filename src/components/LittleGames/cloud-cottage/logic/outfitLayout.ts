import type { OutfitId } from "../types";
import { OUTFIT_VISUALS } from "../ui/cottageAssets";
import { OUTFIT_METRICS } from "../ui/spriteMetrics";

/**
 * Resolved position of an outfit layer, as percentages of the square avatar
 * canvas. Every value is a plain CSS box edge, so `PetAvatar` can apply them
 * directly without a compensating transform.
 */
export type OutfitBox = {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Turns an outfit's authored anchor into a concrete box.
 *
 * Head pieces are pinned by their bottom edge because that is the edge that has
 * to clear her eyes; neck pieces are pinned by their top edge because that is
 * the edge that meets her chin. Height comes from the real asset ratio rather
 * than a hand-tuned constant, which is only valid because the avatar canvas is
 * square — a percentage of its width and of its height are the same length.
 */
export function outfitBox(outfitId: OutfitId): OutfitBox {
  const visual = OUTFIT_VISUALS[outfitId];
  const metrics = OUTFIT_METRICS[outfitId];
  const widthPercent = visual.widthPercent;
  const heightPercent = widthPercent * (metrics.height / metrics.width);

  return {
    leftPercent: round(visual.centerXPercent - widthPercent / 2),
    topPercent: round(
      visual.anchor === "bottom"
        ? visual.anchorYPercent - heightPercent
        : visual.anchorYPercent,
    ),
    widthPercent: round(widthPercent),
    heightPercent: round(heightPercent),
  };
}
