import { describe, expect, it } from "vitest";
import type { Rng } from "./rng";
import { pickWeighted, rollInt } from "./weighted";

const seq = (values: number[]): Rng => {
  let i = 0;
  return () => values[i++];
};

describe("pickWeighted", () => {
  const entries = [
    { id: "a", weight: 1 },
    { id: "b", weight: 3 },
  ];

  it("selects by weighted threshold", () => {
    // total = 4. r = rng()*4.
    expect(pickWeighted(entries, seq([0])).id).toBe("a"); // r=0 -> a
    expect(pickWeighted(entries, seq([0.5])).id).toBe("b"); // r=2 -> a(1) then b
    expect(pickWeighted(entries, seq([0.99])).id).toBe("b"); // r=3.96 -> b
  });

  it("returns the only entry when there is one", () => {
    expect(pickWeighted([{ id: "solo", weight: 5 }], seq([0.7])).id).toBe("solo");
  });

  it("throws on an empty pool", () => {
    expect(() => pickWeighted([], seq([0]))).toThrow();
  });
});

describe("rollInt", () => {
  it("returns min at rng 0 and max near rng 1, inclusive", () => {
    expect(rollInt(5, 8, seq([0]))).toBe(5);
    expect(rollInt(5, 8, seq([0.999]))).toBe(8);
    expect(rollInt(5, 8, seq([0.5]))).toBe(7); // 5 + floor(0.5*4) = 5 + 2
  });

  it("handles a single-value range", () => {
    expect(rollInt(3, 3, seq([0.99]))).toBe(3);
  });
});
