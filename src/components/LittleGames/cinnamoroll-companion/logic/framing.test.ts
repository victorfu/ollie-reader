import { describe, expect, it } from "vitest";
import { fitCameraDistance } from "./framing";

const FOV_DEG = 30;
const SUBJECT = { width: 4.6, height: 3.2 };
const LIMITS = { widthFraction: 0.8, heightFraction: 0.72 };

/** Fraction of the view the subject covers at a distance, computed by hand. */
function coverage(distance: number, aspect: number) {
  const viewHeight = 2 * distance * Math.tan((FOV_DEG * Math.PI) / 360);
  return {
    width: SUBJECT.width / (viewHeight * aspect),
    height: SUBJECT.height / viewHeight,
  };
}

describe("fitCameraDistance", () => {
  it("fills the target width on a portrait phone", () => {
    const aspect = 390 / 780;
    const distance = fitCameraDistance({
      aspect,
      fovDeg: FOV_DEG,
      ...SUBJECT,
      ...LIMITS,
    });

    expect(coverage(distance, aspect).width).toBeCloseTo(0.8, 5);
    expect(coverage(distance, aspect).height).toBeLessThan(0.72);
  });

  it("keeps the whole subject in frame on a wide desktop window", () => {
    const aspect = 1920 / 900;
    const distance = fitCameraDistance({
      aspect,
      fovDeg: FOV_DEG,
      ...SUBJECT,
      ...LIMITS,
    });

    expect(coverage(distance, aspect).height).toBeCloseTo(0.72, 5);
    expect(coverage(distance, aspect).width).toBeLessThan(0.8);
  });
});
