import { describe, expect, it } from "vitest";
import { compileFlightPath, compilePath, pointAtDistance } from "./path";

const L_SHAPE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 60 },
];

describe("compilePath", () => {
  it("accumulates segment lengths", () => {
    const path = compilePath(L_SHAPE);

    expect(path.cumulative).toEqual([0, 100, 160]);
    expect(path.totalLength).toBe(160);
  });

  it("rejects paths that cannot define a direction", () => {
    expect(() => compilePath([{ x: 0, y: 0 }])).toThrow(/至少要有兩個點/);
  });
});

describe("pointAtDistance", () => {
  it("returns the start and end points at the extremes", () => {
    const path = compilePath(L_SHAPE);

    expect(pointAtDistance(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAtDistance(path, 160)).toEqual({ x: 100, y: 60 });
  });

  it("clamps instead of extrapolating past either end", () => {
    const path = compilePath(L_SHAPE);

    expect(pointAtDistance(path, -50)).toEqual({ x: 0, y: 0 });
    expect(pointAtDistance(path, 9999)).toEqual({ x: 100, y: 60 });
  });

  it("interpolates within the first segment", () => {
    const path = compilePath(L_SHAPE);

    expect(pointAtDistance(path, 25)).toEqual({ x: 25, y: 0 });
  });

  it("interpolates within a later segment", () => {
    const path = compilePath(L_SHAPE);

    expect(pointAtDistance(path, 130)).toEqual({ x: 100, y: 30 });
  });

  it("lands exactly on a corner point", () => {
    const path = compilePath(L_SHAPE);

    expect(pointAtDistance(path, 100)).toEqual({ x: 100, y: 0 });
  });

  it("survives zero-length segments from duplicated points", () => {
    const path = compilePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);

    expect(path.totalLength).toBe(20);
    expect(pointAtDistance(path, 10)).toEqual({ x: 10, y: 0 });
    expect(pointAtDistance(path, 15)).toEqual({ x: 10, y: 5 });
  });
});

describe("compileFlightPath", () => {
  it("cuts the corners by flying straight from start to finish", () => {
    const flight = compileFlightPath(L_SHAPE);

    expect(flight.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 60 },
    ]);
    expect(flight.totalLength).toBeCloseTo(Math.hypot(100, 60), 6);
  });
});
