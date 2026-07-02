import { describe, expect, it } from "vitest";
import { effectivenessBadge } from "./battleText";

describe("effectivenessBadge", () => {
  it("labels super effective moves with the spec wording", () => {
    expect(effectivenessBadge(2)).toEqual({ label: "剋制 2x", tone: "strong" });
  });

  it("labels resisted moves with the spec wording", () => {
    expect(effectivenessBadge(0.5)).toEqual({ label: "不利 0.5x", tone: "weak" });
  });

  it("hides neutral effectiveness", () => {
    expect(effectivenessBadge(1)).toBeNull();
  });
});
