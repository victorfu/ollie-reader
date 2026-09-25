import { describe, expect, it } from "vitest";
import {
  printRegionWidthPercent,
  regionAspectRatio,
  regionImageStyle,
  thumbnailMaxWidth,
} from "./cropStyle";

describe("regionImageStyle", () => {
  it("scales and offsets the full page so only the box shows", () => {
    expect(regionImageStyle({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 })).toEqual({
      width: "200%",
      height: "400%",
      left: "-50%",
      top: "-200%",
    });
  });

  it("is the identity for a full-page box", () => {
    expect(regionImageStyle({ x: 0, y: 0, w: 1, h: 1 })).toEqual({
      width: "100%",
      height: "100%",
      left: "0%",
      top: "0%",
    });
  });
});

describe("regionAspectRatio", () => {
  it("uses the box size in real pixels", () => {
    expect(
      regionAspectRatio(
        { x: 0, y: 0, w: 0.5, h: 0.25 },
        { width: 1000, height: 2000 },
      ),
    ).toBeCloseTo(1);
    expect(
      regionAspectRatio(
        { x: 0, y: 0, w: 1, h: 0.1 },
        { width: 1000, height: 1400 },
      ),
    ).toBeCloseTo(1000 / 140);
  });
});

describe("thumbnailMaxWidth", () => {
  it("caps the width so the height stays under the limit", () => {
    expect(thumbnailMaxWidth(2, 160)).toBe("min(100%, 320px)");
    expect(thumbnailMaxWidth(0.5, 160)).toBe("min(100%, 80px)");
  });
});

describe("printRegionWidthPercent", () => {
  it("keeps the original proportion of the page width", () => {
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.5, h: 0.1 }, 1)).toBeCloseTo(50);
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.5, h: 0.1 }, 0.85)).toBeCloseTo(42.5);
  });

  it("never exceeds the content column", () => {
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.95, h: 0.1 }, 1.15)).toBe(100);
  });
});
