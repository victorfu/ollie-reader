import { describe, expect, it } from "vitest";
import { computeFractionSteps, parseFractionInput } from "./fraction";

const f = (num: number, den: number) => ({ num, den });

describe("computeFractionSteps", () => {
  it("adds fractions with different denominators via the common denominator", () => {
    const result = computeFractionSteps(f(1, 2), "+", f(1, 3));
    expect(result).toEqual({
      ok: true,
      steps: [
        { kind: "pair", left: f(3, 6), op: "+", right: f(2, 6) },
        { kind: "value", fraction: f(5, 6) },
      ],
    });
  });

  it("adds same-denominator fractions directly and reduces", () => {
    const result = computeFractionSteps(f(1, 4), "+", f(1, 4));
    expect(result).toEqual({
      ok: true,
      steps: [
        { kind: "value", fraction: f(2, 4) },
        { kind: "value", fraction: f(1, 2) },
      ],
    });
  });

  it("rewrites subtraction as adding the negative", () => {
    const result = computeFractionSteps(f(1, 2), "-", f(3, 4));
    expect(result).toEqual({
      ok: true,
      steps: [
        { kind: "pair", left: f(1, 2), op: "+", right: f(-3, 4) },
        { kind: "pair", left: f(2, 4), op: "+", right: f(-3, 4) },
        { kind: "value", fraction: f(-1, 4) },
        { kind: "value", negative: true, fraction: f(1, 4) },
      ],
    });
  });

  it("rewrites division as multiplying by the reciprocal and gives a mixed number", () => {
    const result = computeFractionSteps(f(3, 2), "/", f(1, 3));
    expect(result).toEqual({
      ok: true,
      steps: [
        { kind: "pair", left: f(3, 2), op: "*", right: f(3, 1) },
        { kind: "value", fraction: f(9, 2) },
        { kind: "value", whole: 4, fraction: f(1, 2) },
      ],
    });
  });

  it("reduces then converts to a whole number when nothing is left over", () => {
    const result = computeFractionSteps(f(4, 3), "*", f(3, 2));
    expect(result).toEqual({
      ok: true,
      steps: [
        { kind: "value", fraction: f(12, 6) },
        { kind: "value", fraction: f(2, 1) },
        { kind: "value", whole: 2 },
      ],
    });
  });

  it("collapses 0, 1 and -1 results to whole numbers", () => {
    expect(computeFractionSteps(f(1, 2), "-", f(1, 2))).toMatchObject({
      steps: [{}, { kind: "value", fraction: f(0, 2) }, { kind: "value", whole: 0 }],
    });
    expect(computeFractionSteps(f(1, 1), "*", f(1, 1))).toEqual({
      ok: true,
      steps: [
        { kind: "value", fraction: f(1, 1) },
        { kind: "value", whole: 1 },
      ],
    });
    expect(computeFractionSteps(f(-1, 2), "*", f(2, 1))).toMatchObject({
      steps: [{ kind: "value", fraction: f(-2, 2) }, { kind: "value", whole: -1 }],
    });
  });

  it("normalises the sign of a negative mixed number", () => {
    const result = computeFractionSteps(f(-7, 2), "*", f(1, 1));
    expect(result).toEqual({
      ok: true,
      steps: [
        { kind: "value", fraction: f(-7, 2) },
        { kind: "value", negative: true, fraction: f(7, 2) },
        { kind: "value", negative: true, whole: 3, fraction: f(1, 2) },
      ],
    });
  });

  it("makes a double-negative fraction positive", () => {
    const result = computeFractionSteps(f(-1, 3), "*", f(1, -1));
    expect(result).toEqual({
      ok: true,
      steps: [
        { kind: "value", fraction: f(-1, -3) },
        { kind: "value", fraction: f(1, 3) },
      ],
    });
  });

  it("rejects zero denominators and division by zero", () => {
    expect(computeFractionSteps(f(1, 0), "+", f(1, 2))).toEqual({
      ok: false,
      error: "divideByZero",
    });
    expect(computeFractionSteps(f(1, 2), "/", f(0, 5))).toEqual({
      ok: false,
      error: "divideByZero",
    });
  });
});

describe("parseFractionInput", () => {
  it("parses integers and flags blanks and non-integers", () => {
    expect(parseFractionInput("12")).toBe(12);
    expect(parseFractionInput(" -3 ")).toBe(-3);
    expect(parseFractionInput("")).toBe("empty");
    expect(parseFractionInput("-")).toBe("empty");
    expect(parseFractionInput("1.5")).toBe("invalid");
    expect(parseFractionInput("1e3")).toBe("invalid");
  });
});
