import { describe, expect, it } from "vitest";
import { FURNITURE } from "../data/furniture";
import { FURNITURE_IDS } from "../types";
import { FURNITURE_VISUALS } from "../ui/cottageAssets";
import {
  ROOM_ASPECT,
  ZONE_BOUNDS,
  clampPlacement,
  placementBounds,
  spriteHalfExtents,
} from "./roomLayout";

describe("spriteHalfExtents", () => {
  it("scales the vertical extent by the room aspect", () => {
    // cloud-bed is 34% wide and 351x324, so it is 34 * (324/351) * 1.5 = 47.1%
    // of the room's height — far taller than its width suggests.
    const { halfXPercent, halfYPercent } = spriteHalfExtents("cloud-bed");
    expect(halfXPercent).toBe(17);
    expect(halfYPercent).toBeCloseTo((34 * (324 / 351) * ROOM_ASPECT) / 2, 3);
    expect(halfYPercent).toBeGreaterThan(halfXPercent);
  });
});

describe("placementBounds", () => {
  it("tightens the zone so a tall sprite cannot hang out of the room", () => {
    // The floor zone allows y up to 89, but the bed's own height pulls that in.
    expect(ZONE_BOUNDS.floor.maxY).toBe(89);
    expect(placementBounds("cloud-bed").maxY).toBeCloseTo(76.46, 1);
  });

  it("folds in the offsets RoomWorld applies after the saved coordinate", () => {
    // The rug renders 3% lower than its stored y, so its ceiling drops by 3.
    expect(FURNITURE_VISUALS.rug.offsetYPercent).toBe(3);
    const withOffset = placementBounds("rug");
    expect(withOffset.maxY).toBeCloseTo(
      100 - spriteHalfExtents("rug").halfYPercent - 3,
      2,
    );
  });

  it("leaves a small sprite's zone bounds alone", () => {
    expect(placementBounds("lamp").minX).toBe(ZONE_BOUNDS.floor.minX);
    expect(placementBounds("lamp").maxX).toBe(ZONE_BOUNDS.floor.maxX);
  });

  it("never returns inverted bounds", () => {
    for (const id of FURNITURE_IDS) {
      const bounds = placementBounds(id);
      expect(bounds.minX).toBeLessThanOrEqual(bounds.maxX);
      expect(bounds.minY).toBeLessThanOrEqual(bounds.maxY);
    }
  });
});

describe("clampPlacement", () => {
  it("rejects unknown furniture and non-finite coordinates", () => {
    expect(clampPlacement("not-a-thing", 50, 50)).toBeNull();
    expect(clampPlacement("lamp", Number.NaN, 50)).toBeNull();
    expect(clampPlacement("lamp", 50, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("repairs a bed saved at the old floor limit", () => {
    // The exact save shape that rendered as a bed sliced in half.
    expect(clampPlacement("cloud-bed", 76, 89)).toEqual({
      id: "cloud-bed",
      x: 76,
      y: 76.46,
      zone: "floor",
    });
  });

  it("leaves the default placement untouched", () => {
    expect(clampPlacement("cloud-bed", 76, 68)).toEqual({
      id: "cloud-bed",
      x: 76,
      y: 68,
      zone: "floor",
    });
  });

  it("pulls wildly out-of-range coordinates back into the zone", () => {
    expect(clampPlacement("lamp", 120, -5)).toEqual({
      id: "lamp",
      x: 93,
      y: 63,
      zone: "floor",
    });
  });

  it("always reports the definition's zone", () => {
    expect(clampPlacement("picture", 50, 90)?.zone).toBe("wall");
  });

  it.each(FURNITURE)(
    "keeps $id fully inside the room at every corner of its zone",
    ({ id }) => {
      const { halfXPercent, halfYPercent } = spriteHalfExtents(id);
      const visual = FURNITURE_VISUALS[id];
      const offsetX = visual.offsetXPercent ?? 0;
      const offsetY = visual.offsetYPercent ?? 0;

      // Push at each corner well past the legal area; the result must still
      // render entirely on screen once the render-time offsets are applied.
      for (const [x, y] of [
        [-999, -999],
        [999, -999],
        [-999, 999],
        [999, 999],
      ]) {
        const placed = clampPlacement(id, x, y);
        expect(placed).not.toBeNull();
        if (!placed) continue;
        expect(placed.x + offsetX - halfXPercent).toBeGreaterThanOrEqual(-0.01);
        expect(placed.x + offsetX + halfXPercent).toBeLessThanOrEqual(100.01);
        expect(placed.y + offsetY - halfYPercent).toBeGreaterThanOrEqual(-0.01);
        expect(placed.y + offsetY + halfYPercent).toBeLessThanOrEqual(100.01);
      }
    },
  );
});
