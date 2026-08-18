import { describe, expect, it } from "vitest";
import { OUTFIT_IDS } from "../types";
import { OUTFIT_VISUALS } from "../ui/cottageAssets";
import { PET_ANATOMY } from "../ui/spriteMetrics";
import { outfitBox } from "./outfitLayout";

const HEAD_OUTFITS = OUTFIT_IDS.filter(
  (id) => OUTFIT_VISUALS[id].slot === "head",
);
const NECK_OUTFITS = OUTFIT_IDS.filter(
  (id) => OUTFIT_VISUALS[id].slot === "neck",
);

describe("outfitBox", () => {
  it("derives height from the asset ratio", () => {
    // flower-crown is 380x242, so 38% wide renders 24.2% tall.
    const box = outfitBox("flower-crown");
    expect(box.widthPercent).toBe(38);
    expect(box.heightPercent).toBeCloseTo(38 * (242 / 380), 2);
  });

  it("pins head pieces by their bottom edge", () => {
    const box = outfitBox("flower-crown");
    expect(box.topPercent + box.heightPercent).toBeCloseTo(
      OUTFIT_VISUALS["flower-crown"].anchorYPercent,
      2,
    );
  });

  it("pins neck pieces by their top edge", () => {
    const box = outfitBox("red-ribbon");
    expect(box.topPercent).toBeCloseTo(
      OUTFIT_VISUALS["red-ribbon"].anchorYPercent,
      2,
    );
  });

  it("centres every layer on its authored centre", () => {
    for (const id of OUTFIT_IDS) {
      const box = outfitBox(id);
      expect(box.leftPercent + box.widthPercent / 2).toBeCloseTo(
        OUTFIT_VISUALS[id].centerXPercent,
        2,
      );
    }
  });
});

describe("outfit placement invariants", () => {
  it.each(HEAD_OUTFITS)(
    "keeps %s from resting on her face",
    (id) => {
      // The bottom edge is the edge that would sit over her eyes. Arch-shaped
      // pieces are allowed to reach the top of the eye band because their ink
      // is at the sides — pixel coverage is verified separately by
      // scripts/preview_cottage_outfits.py.
      expect(outfitBox(id).topPercent + outfitBox(id).heightPercent)
        .toBeLessThanOrEqual(PET_ANATOMY.eyeBand.bottom - 6);
    },
  );

  it.each(HEAD_OUTFITS)("keeps %s reaching onto the head dome", (id) => {
    // A head piece whose whole box floats above the head reads as detached.
    expect(outfitBox(id).topPercent).toBeLessThan(PET_ANATOMY.headTopPercent);
    expect(outfitBox(id).topPercent + outfitBox(id).heightPercent)
      .toBeGreaterThan(PET_ANATOMY.headTopPercent);
  });

  it.each(NECK_OUTFITS)("keeps %s below her face", (id) => {
    expect(outfitBox(id).topPercent).toBeGreaterThanOrEqual(
      PET_ANATOMY.faceBand.bottom - 1,
    );
  });

  it.each(OUTFIT_IDS)("keeps %s inside the avatar canvas", (id) => {
    const box = outfitBox(id);
    expect(box.leftPercent).toBeGreaterThanOrEqual(0);
    expect(box.leftPercent + box.widthPercent).toBeLessThanOrEqual(100);
    expect(box.topPercent).toBeGreaterThanOrEqual(0);
    expect(box.topPercent + box.heightPercent).toBeLessThanOrEqual(100);
  });

  it("matches the pixel-verified layout", () => {
    // Every entry below was confirmed at 0% eye and mouth coverage. Changing a
    // number here means re-running the preview script before updating this.
    expect(
      Object.fromEntries(OUTFIT_IDS.map((id) => [id, outfitBox(id)])),
    ).toMatchSnapshot();
  });
});
