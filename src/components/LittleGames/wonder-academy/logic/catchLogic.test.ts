import { describe, expect, it } from "vitest";
import type { CatchContext } from "./catchLogic";
import { attemptCatch, computeCatchChance } from "./catchLogic";
import { createRng } from "./rng";

const ctx = (overrides: Partial<CatchContext> = {}): CatchContext => ({
  hpRatio: 0.15,
  rarity: "common",
  treatTier: 1,
  isFavoriteSnack: false,
  ...overrides,
});

describe("computeCatchChance", () => {
  it("rises as the target's hp drops", () => {
    const low = computeCatchChance(ctx({ hpRatio: 0.1 }));
    const high = computeCatchChance(ctx({ hpRatio: 0.8 }));
    expect(low).toBeGreaterThan(high);
  });

  it("rewards bringing the favorite snack", () => {
    expect(
      computeCatchChance(ctx({ isFavoriteSnack: true })),
    ).toBeGreaterThan(computeCatchChance(ctx({ isFavoriteSnack: false })));
  });

  it("makes rarer creatures harder to catch", () => {
    expect(computeCatchChance(ctx({ rarity: "mythling" }))).toBeLessThan(
      computeCatchChance(ctx({ rarity: "common" })),
    );
  });

  it("stays within [0.05, 0.95]", () => {
    const guaranteedish = computeCatchChance(
      ctx({ hpRatio: 0, rarity: "common", treatTier: 3, isFavoriteSnack: true }),
    );
    const nearImpossible = computeCatchChance(
      ctx({ hpRatio: 1, rarity: "mythling", treatTier: 1, isFavoriteSnack: false }),
    );
    expect(guaranteedish).toBeLessThanOrEqual(0.95);
    expect(nearImpossible).toBeGreaterThanOrEqual(0.05);
  });

  it("keeps sleepy common favorite-snack catches high but not guaranteed", () => {
    const chance = computeCatchChance(
      ctx({ hpRatio: 0.2, rarity: "common", treatTier: 2, isFavoriteSnack: true }),
    );

    expect(chance).toBeGreaterThanOrEqual(0.85);
    expect(chance).toBeLessThanOrEqual(0.95);
  });

  it("keeps healthy uncommon non-favorite catches meaningfully harder", () => {
    const chance = computeCatchChance(
      ctx({ hpRatio: 0.8, rarity: "uncommon", treatTier: 2, isFavoriteSnack: false }),
    );

    expect(chance).toBeGreaterThanOrEqual(0.2);
    expect(chance).toBeLessThanOrEqual(0.45);
  });
});

describe("attemptCatch", () => {
  it("is deterministic for a given seed and reports the chance used", () => {
    const a = attemptCatch(ctx(), createRng(7));
    const b = attemptCatch(ctx(), createRng(7));
    expect(a).toEqual(b);
    expect(a.chance).toBe(computeCatchChance(ctx()));
    expect(typeof a.caught).toBe("boolean");
  });
});
