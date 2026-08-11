import { describe, expect, it } from "vitest";
import {
  advanceEnemyVerticalMotion,
  consumePlayerJump,
  pressJump,
  releaseJump,
} from "./behavior";
import { SPRING_SPEED } from "./constants";
import type { Enemy } from "./types";

describe("mushroom jump input", () => {
  it("consumes one jump per key press instead of once per rendered frame", () => {
    const input = { jump: false, jumpQueued: false };
    const player = { vy: 0, onGround: true, jumps: 0 };

    pressJump(input);
    expect(consumePlayerJump(input, player, true)).toBe(true);
    expect(player.jumps).toBe(1);

    // Browser key-repeat and subsequent frames while the key remains held do
    // not queue a second press, so the feather is preserved.
    pressJump(input);
    expect(consumePlayerJump(input, player, true)).toBe(false);
    expect(player.jumps).toBe(1);

    releaseJump(input);
    pressJump(input);
    expect(consumePlayerJump(input, player, true)).toBe(true);
    expect(player.jumps).toBe(2);
  });

  it("does not overwrite a spring launch while the jump key stays held", () => {
    const input = { jump: true, jumpQueued: false };
    const player = {
      vy: -SPRING_SPEED,
      onGround: false,
      jumps: 1,
    };

    expect(consumePlayerJump(input, player, true)).toBe(false);
    expect(player.vy).toBe(-SPRING_SPEED);
    expect(player.jumps).toBe(1);
  });
});

describe("mushroom jumper enemy", () => {
  it("starts a jump from rest before gravity is applied", () => {
    const enemy: Enemy = {
      x: 100,
      y: 468,
      w: 36,
      h: 32,
      dir: -1,
      speed: 100,
      alive: true,
      type: "jumper",
      vy: 0,
      jumpTimer: 0,
    };

    advanceEnemyVerticalMotion(enemy, 300, 1 / 60, () => 0.25);

    expect(enemy.vy).toBeLessThan(0);
    expect(enemy.y).toBeLessThan(468);
    expect(enemy.jumpTimer).toBe(1.25);
    expect(enemy.dir).toBe(1);
  });
});
