import { describe, expect, it } from "vitest";
import {
  applyGachaDraw,
  canTransitionGachaPhase,
  createEmptyGachaSave,
  normalizeGachaSave,
  pickGachaCharacter,
  transitionGachaPhase,
} from "./gachaLogic";
import { GACHA_CHARACTER_IDS } from "./gachaTypes";

describe("pickGachaCharacter", () => {
  it("maps 12 equal-width RNG intervals to the 12 characters", () => {
    GACHA_CHARACTER_IDS.forEach((characterId, index) => {
      const middleOfInterval = (index + 0.5) / GACHA_CHARACTER_IDS.length;
      expect(pickGachaCharacter(() => middleOfInterval)).toBe(characterId);
    });
  });

  it("handles the inclusive lower and exclusive upper boundaries", () => {
    expect(pickGachaCharacter(() => 0)).toBe("hello-kitty");
    expect(pickGachaCharacter(() => 1 / 12)).toBe("my-melody");
    expect(pickGachaCharacter(() => 0.9999999999999999)).toBe("gudetama");
  });

  it("rejects RNG values outside the Math.random contract", () => {
    expect(() => pickGachaCharacter(() => -0.01)).toThrow(RangeError);
    expect(() => pickGachaCharacter(() => 1)).toThrow(RangeError);
    expect(() => pickGachaCharacter(() => Number.NaN)).toThrow(RangeError);
  });
});

describe("gacha phase transitions", () => {
  it("allows the reveal sequence and a reset after reveal", () => {
    expect(transitionGachaPhase("idle", "coinInserted")).toBe("coinInserted");
    expect(transitionGachaPhase("coinInserted", "turning")).toBe("turning");
    expect(transitionGachaPhase("turning", "capsuleReady")).toBe("capsuleReady");
    expect(transitionGachaPhase("capsuleReady", "revealed")).toBe("revealed");
    expect(transitionGachaPhase("revealed", "idle")).toBe("idle");
  });

  it("allows cancellation or failure to reset an in-progress draw", () => {
    expect(canTransitionGachaPhase("coinInserted", "idle")).toBe(true);
    expect(canTransitionGachaPhase("turning", "idle")).toBe(true);
    expect(canTransitionGachaPhase("capsuleReady", "idle")).toBe(true);
  });

  it("rejects skipped and repeated phases", () => {
    expect(canTransitionGachaPhase("idle", "turning")).toBe(false);
    expect(() => transitionGachaPhase("idle", "revealed")).toThrow(
      "Invalid gacha phase transition",
    );
    expect(() => transitionGachaPhase("turning", "turning")).toThrow();
  });
});

describe("normalizeGachaSave", () => {
  it("normalizes counts and removes unknown character ids", () => {
    expect(
      normalizeGachaSave({
        schemaVersion: 999,
        totalDraws: -8,
        ownedCounts: {
          "hello-kitty": 2.9,
          kuromi: -4,
          gudetama: Number.NaN,
          unknown: 50,
        },
      }),
    ).toEqual({
      schemaVersion: 1,
      totalDraws: 2,
      ownedCounts: { "hello-kitty": 2 },
    });
  });

  it("returns a fresh empty save for malformed input", () => {
    const first = normalizeGachaSave(null);
    const second = normalizeGachaSave("broken");
    expect(first).toEqual(createEmptyGachaSave());
    expect(first).not.toBe(second);
    expect(first.ownedCounts).not.toBe(second.ownedCounts);
  });
});

describe("applyGachaDraw", () => {
  it("unlocks a new character without mutating the previous save", () => {
    const previous = createEmptyGachaSave();
    const applied = applyGachaDraw(previous, "cinnamoroll");

    expect(applied).toEqual({
      save: {
        schemaVersion: 1,
        totalDraws: 1,
        ownedCounts: { cinnamoroll: 1 },
      },
      result: {
        characterId: "cinnamoroll",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    });
    expect(previous).toEqual(createEmptyGachaSave());
  });

  it("increments a duplicate while preserving other owned characters", () => {
    const applied = applyGachaDraw(
      {
        schemaVersion: 1,
        totalDraws: 4,
        ownedCounts: { kuromi: 2, keroppi: 2 },
      },
      "kuromi",
    );

    expect(applied.save).toEqual({
      schemaVersion: 1,
      totalDraws: 5,
      ownedCounts: { kuromi: 3, keroppi: 2 },
    });
    expect(applied.result).toEqual({
      characterId: "kuromi",
      isNew: false,
      ownedCount: 3,
      totalDraws: 5,
    });
  });
});
