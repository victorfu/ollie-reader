import { describe, expect, it } from "vitest";
import { chooseCatchSnack } from "./catchSnacks";

const snackOrder = ["starberry-cookie", "moon-milk-puff", "clover-macaron"];

describe("chooseCatchSnack", () => {
  it("prefers and consumes the favorite snack", () => {
    expect(
      chooseCatchSnack(
        { "starberry-cookie": 2, "clover-macaron": 1 },
        "clover-macaron",
        snackOrder,
      ),
    ).toEqual({
      snackId: "clover-macaron",
      snacks: { "starberry-cookie": 2, "clover-macaron": 0 },
      isFavorite: true,
      treatTier: 2,
    });
  });

  it("consumes the first available known snack when the favorite is missing", () => {
    expect(
      chooseCatchSnack(
        { "starberry-cookie": 0, "moon-milk-puff": 3, "clover-macaron": 1 },
        "starberry-cookie",
        snackOrder,
      ),
    ).toEqual({
      snackId: "moon-milk-puff",
      snacks: { "starberry-cookie": 0, "moon-milk-puff": 2, "clover-macaron": 1 },
      isFavorite: false,
      treatTier: 2,
    });
  });

  it("returns null when no known snack is available", () => {
    expect(
      chooseCatchSnack({ "unknown-snack": 4, "starberry-cookie": 0 }, "starberry-cookie", snackOrder),
    ).toBeNull();
  });
});
