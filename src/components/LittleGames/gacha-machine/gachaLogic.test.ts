import { describe, expect, it } from "vitest";
import {
  applyGachaAttempt,
  canTransitionGachaPhase,
  createEmptyGachaSave,
  MISS_RATE,
  normalizeGachaSave,
  pickGachaOutcome,
  transitionGachaPhase,
} from "./gachaLogic";
import { GACHA_CHARACTER_IDS } from "./gachaTypes";

describe("gacha character ids", () => {
  it("contains 37 unique ids while preserving the original 12 order", () => {
    expect(GACHA_CHARACTER_IDS).toHaveLength(37);
    expect(new Set(GACHA_CHARACTER_IDS).size).toBe(37);
    expect(GACHA_CHARACTER_IDS.slice(0, 12)).toEqual([
      "hello-kitty",
      "my-melody",
      "cinnamoroll",
      "pompompurin",
      "little-twin-stars",
      "keroppi",
      "pochacco",
      "kuromi",
      "badtz-maru",
      "tuxedosam",
      "hangyodon",
      "gudetama",
    ]);
    expect(GACHA_CHARACTER_IDS.at(-1)).toBe("nya-ni-nyu-nye-nyon");
  });
});

describe("pickGachaOutcome", () => {
  it("uses the first 50 percent of the RNG range for misses", () => {
    expect(MISS_RATE).toBe(0.5);
    expect(pickGachaOutcome(() => 0)).toEqual({ kind: "miss" });
    expect(pickGachaOutcome(() => MISS_RATE - Number.EPSILON)).toEqual({
      kind: "miss",
    });
  });

  it("maps the remaining range equally across all 37 characters", () => {
    GACHA_CHARACTER_IDS.forEach((characterId, index) => {
      const middleOfHitInterval = MISS_RATE
        + ((index + 0.5) / GACHA_CHARACTER_IDS.length) * (1 - MISS_RATE);
      expect(pickGachaOutcome(() => middleOfHitInterval)).toEqual({
        kind: "character",
        characterId,
      });
    });
  });

  it("handles the inclusive hit boundary and exclusive RNG upper boundary", () => {
    expect(pickGachaOutcome(() => MISS_RATE)).toEqual({
      kind: "character",
      characterId: "hello-kitty",
    });
    expect(pickGachaOutcome(() => 0.9999999999999999)).toEqual({
      kind: "character",
      characterId: "nya-ni-nyu-nye-nyon",
    });
  });

  it("rejects RNG values outside the Math.random contract", () => {
    expect(() => pickGachaOutcome(() => -0.01)).toThrow(RangeError);
    expect(() => pickGachaOutcome(() => 1)).toThrow(RangeError);
    expect(() => pickGachaOutcome(() => Number.NaN)).toThrow(RangeError);
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
  it("normalizes versions and counts while removing unknown character ids", () => {
    expect(
      normalizeGachaSave({
        schemaVersion: 999,
        resetVersion: 4.9,
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
      resetVersion: 4,
      totalDraws: 2,
      ownedCounts: { "hello-kitty": 2 },
    });
  });

  it("migrates old V1 saves without resetVersion to version zero", () => {
    expect(
      normalizeGachaSave({
        schemaVersion: 1,
        totalDraws: 1,
        ownedCounts: { kuromi: 1 },
      }),
    ).toEqual({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: { kuromi: 1 },
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

describe("applyGachaAttempt", () => {
  it("counts an empty capsule without changing the collection", () => {
    const previous = {
      schemaVersion: 1 as const,
      resetVersion: 2,
      totalDraws: 3,
      ownedCounts: { kuromi: 2 },
    };

    expect(applyGachaAttempt(previous, { kind: "miss" })).toEqual({
      save: {
        schemaVersion: 1,
        resetVersion: 2,
        totalDraws: 4,
        ownedCounts: { kuromi: 2 },
      },
      result: {
        kind: "miss",
        totalDraws: 4,
      },
    });
    expect(previous.ownedCounts).toEqual({ kuromi: 2 });
  });

  it("unlocks a new character without mutating the previous save", () => {
    const previous = createEmptyGachaSave();
    const applied = applyGachaAttempt(previous, {
      kind: "character",
      characterId: "cinnamoroll",
    });

    expect(applied).toEqual({
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: { cinnamoroll: 1 },
      },
      result: {
        kind: "character",
        characterId: "cinnamoroll",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
    });
    expect(previous).toEqual(createEmptyGachaSave());
  });

  it("increments a duplicate while preserving other owned characters", () => {
    const applied = applyGachaAttempt(
      {
        schemaVersion: 1,
        resetVersion: 3,
        totalDraws: 4,
        ownedCounts: { kuromi: 2, keroppi: 2 },
      },
      { kind: "character", characterId: "kuromi" },
    );

    expect(applied.save).toEqual({
      schemaVersion: 1,
      resetVersion: 3,
      totalDraws: 5,
      ownedCounts: { kuromi: 3, keroppi: 2 },
    });
    expect(applied.result).toEqual({
      kind: "character",
      characterId: "kuromi",
      isNew: false,
      ownedCount: 3,
      totalDraws: 5,
    });
  });

  it("rejects malformed outcomes at runtime", () => {
    expect(() =>
      applyGachaAttempt(
        createEmptyGachaSave(),
        { kind: "character", characterId: "unknown" } as never,
      ),
    ).toThrow("Invalid gacha outcome");
  });
});
