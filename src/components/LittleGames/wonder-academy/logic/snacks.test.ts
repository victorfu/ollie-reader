import { describe, expect, it } from "vitest";
import { isKnownSnack, SNACK_NAMES, SNACK_POOL } from "./snacks";

describe("Wonder Academy snack registry", () => {
  it("contains the canonical starter snack ids", () => {
    expect(SNACK_POOL).toEqual([
      "starberry-cookie",
      "moon-milk-puff",
      "clover-macaron",
      "warm-cocoa-gem",
    ]);
    expect(SNACK_NAMES["starberry-cookie"]).toBe("星莓餅乾");
  });

  it("recognizes only known snack ids", () => {
    expect(isKnownSnack("clover-macaron")).toBe(true);
    expect(isKnownSnack("unknown-snack")).toBe(false);
  });
});
