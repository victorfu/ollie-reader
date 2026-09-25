import { describe, expect, it } from "vitest";
import type { Box } from "../../types/questionBank";
import {
  boxFromPoints,
  clamp01,
  isBoxTooSmall,
  moveBox,
  resizeBox,
  sameBox,
  toRelativePoint,
} from "./boxGeometry";

function expectBox(actual: Box, expected: Box): void {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.w).toBeCloseTo(expected.w, 10);
  expect(actual.h).toBeCloseTo(expected.h, 10);
}

describe("clamp01", () => {
  it("keeps values inside 0–1", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.7)).toBe(1);
  });
});

describe("boxFromPoints", () => {
  it("normalizes a drag in any direction", () => {
    expectBox(boxFromPoints({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 }), {
      x: 0.2,
      y: 0.3,
      w: 0.4,
      h: 0.5,
    });
  });

  it("clamps points that leave the page", () => {
    expectBox(boxFromPoints({ x: -0.2, y: 0.5 }, { x: 0.4, y: 1.3 }), {
      x: 0,
      y: 0.5,
      w: 0.4,
      h: 0.5,
    });
  });
});

describe("isBoxTooSmall", () => {
  it("rejects boxes thinner than 0.01 in either direction", () => {
    expect(isBoxTooSmall({ x: 0, y: 0, w: 0.005, h: 0.5 })).toBe(true);
    expect(isBoxTooSmall({ x: 0, y: 0, w: 0.5, h: 0.009 })).toBe(true);
    expect(isBoxTooSmall({ x: 0, y: 0, w: 0.01, h: 0.01 })).toBe(false);
  });
});

describe("moveBox", () => {
  it("translates the box", () => {
    expectBox(moveBox({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, 0.1, 0.2), {
      x: 0.2,
      y: 0.3,
      w: 0.2,
      h: 0.2,
    });
  });

  it("stops at the page edges without shrinking", () => {
    expectBox(moveBox({ x: 0.7, y: 0.1, w: 0.2, h: 0.2 }, 0.3, -0.5), {
      x: 0.8,
      y: 0,
      w: 0.2,
      h: 0.2,
    });
  });
});

describe("resizeBox", () => {
  const box: Box = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };

  it("moves the dragged corner and keeps the opposite corner fixed", () => {
    expectBox(resizeBox(box, "se", { x: 0.9, y: 0.9 }), {
      x: 0.2,
      y: 0.2,
      w: 0.7,
      h: 0.7,
    });
    expectBox(resizeBox(box, "nw", { x: 0.1, y: 0.1 }), {
      x: 0.1,
      y: 0.1,
      w: 0.5,
      h: 0.5,
    });
    expectBox(resizeBox(box, "ne", { x: 0.7, y: 0.1 }), {
      x: 0.2,
      y: 0.1,
      w: 0.5,
      h: 0.5,
    });
  });

  it("flips instead of producing a negative size", () => {
    expectBox(resizeBox(box, "nw", { x: 0.8, y: 0.8 }), {
      x: 0.6,
      y: 0.6,
      w: 0.2,
      h: 0.2,
    });
  });
});

describe("sameBox", () => {
  it("compares with a tiny tolerance", () => {
    const box: Box = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(sameBox(box, { ...box, x: 0.1 + 1e-12 })).toBe(true);
    expect(sameBox(box, { ...box, w: 0.31 })).toBe(false);
  });
});

describe("toRelativePoint", () => {
  it("converts client coordinates to 0–1 inside the rect", () => {
    const point = toRelativePoint(150, 100, {
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });
    expect(point.x).toBeCloseTo(0.25);
    expect(point.y).toBeCloseTo(0.5);
  });

  it("returns 0 for an unmeasured rect", () => {
    expect(
      toRelativePoint(10, 10, { left: 0, top: 0, width: 0, height: 0 }),
    ).toEqual({ x: 0, y: 0 });
  });
});
