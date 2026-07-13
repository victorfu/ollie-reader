import { describe, it, expect } from "vitest";
import {
  canEvolve,
  checkPendingEvolution,
  applyEvolutionLocally,
} from "./spiritEvolution";
import { getSpiritById } from "../assets/spirits";

// fire-slime 進化條件：train fire 12（見 assets/spirits/index.ts）
const fireSlime = getSpiritById("fire-slime")!;
const cloudPuff = getSpiritById("cloud-puff")!; // 無進化

describe("canEvolve", () => {
  it("is false below the training threshold", () => {
    expect(canEvolve(fireSlime, { fire: 11 })).toBe(false);
  });
  it("is true at or above the threshold", () => {
    expect(canEvolve(fireSlime, { fire: 12 })).toBe(true);
    expect(canEvolve(fireSlime, { fire: 99 })).toBe(true);
  });
  it("is false for spirits with no evolution", () => {
    expect(canEvolve(cloudPuff, { fire: 99, normal: 99 })).toBe(false);
  });
});

describe("checkPendingEvolution", () => {
  it("returns null when no owned spirit is ready", () => {
    expect(
      checkPendingEvolution({
        unlockedSpiritIds: ["fire-slime"],
        evolvedSpiritIds: [],
        elementProgress: { fire: 5 },
      }),
    ).toBeNull();
  });

  it("returns the base and evolved spirit when ready", () => {
    const result = checkPendingEvolution({
      unlockedSpiritIds: ["cloud-puff", "fire-slime"],
      evolvedSpiritIds: [],
      elementProgress: { fire: 12 },
    });
    expect(result?.from.id).toBe("fire-slime");
    expect(result?.to.id).toBe("blaze-drake");
  });

  it("is idempotent: skips spirits already evolved", () => {
    expect(
      checkPendingEvolution({
        unlockedSpiritIds: ["fire-slime"],
        evolvedSpiritIds: ["fire-slime"],
        elementProgress: { fire: 50 },
      }),
    ).toBeNull();
  });

  it("ignores unowned spirits", () => {
    expect(
      checkPendingEvolution({
        unlockedSpiritIds: ["cloud-puff"],
        evolvedSpiritIds: [],
        elementProgress: { fire: 50 },
      }),
    ).toBeNull();
  });
});

describe("applyEvolutionLocally", () => {
  it("adds the base to evolved and the evolved to unlocked", () => {
    const next = applyEvolutionLocally(
      { unlockedSpiritIds: ["fire-slime"], evolvedSpiritIds: [] },
      "fire-slime",
      "blaze-drake",
    );
    expect(next.evolvedSpiritIds).toContain("fire-slime");
    expect(next.unlockedSpiritIds).toContain("blaze-drake");
  });

  it("does not duplicate when applied twice", () => {
    const once = applyEvolutionLocally(
      { unlockedSpiritIds: ["fire-slime"], evolvedSpiritIds: [] },
      "fire-slime",
      "blaze-drake",
    );
    const twice = applyEvolutionLocally(once, "fire-slime", "blaze-drake");
    expect(twice.evolvedSpiritIds).toEqual(["fire-slime"]);
    expect(twice.unlockedSpiritIds.filter((id) => id === "blaze-drake")).toHaveLength(1);
  });
});
