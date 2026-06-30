import { describe, expect, it } from "vitest";
import {
  WONDER_ACADEMY_MOVES,
  getMoveById,
} from "./wonderAcademyMoves";

describe("Wonder Academy moves data", () => {
  it("defines every starter learnable skill", () => {
    const required = [
      // Lumi
      "tiny-flash", "zip-spark", "wink-feint", "starstep-dash", "aurora-parade",
      // Momo
      "bubble-pat", "cozy-shield", "nap-song", "moon-drizzle", "dreamcloud-haven",
      // Pico
      "leaf-wink", "stardust-peek", "clover-patch", "secret-signal", "wishbloom-spiral",
      // Nibi
      "warm-puff", "crystal-brace", "brave-bump", "hearth-guard", "hearth-crystal-roar",
    ];
    for (const id of required) {
      expect(WONDER_ACADEMY_MOVES[id], `missing move ${id}`).toBeDefined();
    }
  });

  it("defines the canonical P1/P2 creature and warden moves", () => {
    const required = [
      "pearl-splash",
      "tideglass-song",
      "seal-slide",
      "clockwork-tap",
      "bell-chime",
      "tanuki-twirl",
      "sugar-sparkle",
      "marshmallow-bounce",
      "maestro-finale",
      "comet-dash",
      "starrail-echo",
      "pillow-moonbeam",
      "dream-drift",
      "silent-bell",
      "heart-crystal",
    ];

    for (const id of required) {
      expect(WONDER_ACADEMY_MOVES[id], `missing move ${id}`).toBeDefined();
    }
  });

  it("keeps sleep moves intentional and readable", () => {
    const sleepMoves = Object.values(WONDER_ACADEMY_MOVES).filter((move) => move.sleep);

    expect(sleepMoves.map((move) => move.id).sort()).toEqual([
      "dream-drift",
      "dreamcloud-haven",
      "nap-song",
      "pillow-moonbeam",
      "tideglass-song",
    ]);
  });

  it("gives every move a positive power and a display name", () => {
    for (const move of Object.values(WONDER_ACADEMY_MOVES)) {
      expect(move.power).toBeGreaterThan(0);
      expect(move.name.length).toBeGreaterThan(0);
      expect(move.id.length).toBeGreaterThan(0);
    }
  });

  it("looks up a move by id and returns null for unknown ids", () => {
    expect(getMoveById("zip-spark")?.element).toBe("spark");
    expect(getMoveById("zip-spark")?.name).toBe("電光衝");
    expect(getMoveById("does-not-exist")).toBeNull();
  });
});
