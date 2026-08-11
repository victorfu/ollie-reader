import { describe, expect, it } from "vitest";
import {
  advanceEnemyVerticalMotion,
  advancePlayerHorizontalMotion,
  consumePlayerJump,
  expireMushroomCombo,
  keepPlayerInsideWorldStart,
  pressJump,
  registerMushroomComboHit,
  releaseJump,
  updateEnemiesUntilPlayerFrameEnds,
} from "./behavior";
import {
  BASE_SPEED,
  GRAVITY,
  JUMP_SPEED,
  SPRING_SPEED,
} from "./constants";
import type { Enemy } from "./types";

function simulateHorizontalMotion(
  fps: number,
  duration: number,
  options: {
    initialVelocity?: number;
    move?: number;
    speedBoost?: number;
  } = {},
) {
  const {
    initialVelocity = 0,
    move = 1,
    speedBoost = 0,
  } = options;
  const player = { x: 0, vx: initialVelocity };
  let elapsed = 0;
  while (elapsed < duration - 1e-12) {
    const dt = Math.min(1 / fps, duration - elapsed);
    advancePlayerHorizontalMotion(player, move, speedBoost, dt);
    elapsed += dt;
  }
  return player;
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    x: 0,
    y: 0,
    w: 36,
    h: 32,
    dir: 1,
    speed: 0,
    alive: true,
    type: "normal",
    ...overrides,
  };
}

describe("mushroom horizontal motion", () => {
  it("keeps the player inside the left edge of the world", () => {
    const player = { x: -12, vx: -180 };

    keepPlayerInsideWorldStart(player);

    expect(player).toEqual({ x: 0, vx: 0 });
  });

  it("preserves the established 60 Hz acceleration and displacement", () => {
    const player = { x: 0, vx: 0 };

    advancePlayerHorizontalMotion(player, 1, 0, 1 / 60);

    const expectedVelocity = (BASE_SPEED * 10) / 60;
    expect(player.vx).toBeCloseTo(expectedVelocity, 10);
    expect(player.x).toBeCloseTo(expectedVelocity / 60, 10);
  });

  it("keeps equal-time speed and distance stable at 60, 120, and 144 Hz", () => {
    const baseline = simulateHorizontalMotion(60, 0.25);

    for (const fps of [120, 144]) {
      const result = simulateHorizontalMotion(fps, 0.25);
      expect(result.vx).toBeCloseTo(baseline.vx, 8);
      expect(result.x).toBeCloseTo(baseline.x, 8);
    }
  });

  it("keeps horizontal jump reach stable across refresh rates", () => {
    const jumpAirtime = (2 * JUMP_SPEED) / GRAVITY;
    const baseline = simulateHorizontalMotion(60, jumpAirtime);

    for (const fps of [120, 144]) {
      const result = simulateHorizontalMotion(fps, jumpAirtime);
      expect(result.vx).toBe(baseline.vx);
      expect(result.x).toBeCloseTo(baseline.x, 2);
    }
  });

  it("composes an expired speed boost transition across refresh rates", () => {
    for (const move of [0, -1]) {
      const firstReferenceFrame = simulateHorizontalMotion(60, 1 / 60, {
        initialVelocity: 675,
        move,
      });
      expect(firstReferenceFrame.vx).toBeCloseTo(500, 10);
      expect(firstReferenceFrame.x).toBeCloseTo(500 / 60, 10);

      const baseline = simulateHorizontalMotion(60, 0.5, {
        initialVelocity: 675,
        move,
      });
      for (const fps of [120, 144]) {
        const result = simulateHorizontalMotion(fps, 0.5, {
          initialVelocity: 675,
          move,
        });
        expect(result.vx).toBeCloseTo(baseline.vx, 8);
        expect(result.x).toBeCloseTo(baseline.x, 8);
      }
    }
  });
});

describe("mushroom combo timing", () => {
  it("expires visibly with game time and remains frozen while paused", () => {
    const combo = { comboCount: 2, lastStompTime: 4 };

    expireMushroomCombo(combo, 5.9, 2);
    expect(combo.comboCount).toBe(2);

    // A pause does not advance game time, so there is nothing to expire.
    expireMushroomCombo(combo, 5.9, 2);
    expect(combo.comboCount).toBe(2);

    expireMushroomCombo(combo, 6.01, 2);
    expect(combo.comboCount).toBe(0);
  });

  it("starts a new combo after expiry", () => {
    const combo = { comboCount: 4, lastStompTime: 1 };
    expireMushroomCombo(combo, 4, 2);

    expect(registerMushroomComboHit(combo, 4, 2)).toBe(1);
    expect(registerMushroomComboHit(combo, 5, 2)).toBe(2);
  });
});

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

describe("mushroom player damage frame boundary", () => {
  it("loses only one life when multiple enemies overlap in the same frame", () => {
    const player = { x: 0, y: 0, w: 36, h: 48, vy: 0 };
    const enemies = [makeEnemy(), makeEnemy()];
    let lives = 3;
    let updatedEnemies = 0;

    const frameEnded = updateEnemiesUntilPlayerFrameEnds(player, enemies, {
      updateEnemy: () => {
        updatedEnemies += 1;
      },
      isPlayerInvincible: () => false,
      defeatEnemy: () => {
        throw new Error("side contact must not defeat an enemy");
      },
      hitPlayer: () => {
        lives -= 1;
        return true;
      },
    });

    expect(frameEnded).toBe(true);
    expect(lives).toBe(2);
    expect(updatedEnemies).toBe(1);
  });

  it("stops all later enemy work after a lethal hit", () => {
    const player = { x: 0, y: 0, w: 36, h: 48, vy: 0 };
    const enemies = [makeEnemy(), makeEnemy(), makeEnemy()];
    let lives = 1;
    const updatedEnemies: Enemy[] = [];

    const frameEnded = updateEnemiesUntilPlayerFrameEnds(player, enemies, {
      updateEnemy: (enemy) => {
        updatedEnemies.push(enemy);
      },
      isPlayerInvincible: () => false,
      defeatEnemy: () => {
        throw new Error("side contact must not defeat an enemy");
      },
      hitPlayer: () => {
        lives -= 1;
        return true;
      },
    });

    expect(frameEnded).toBe(true);
    expect(lives).toBe(0);
    expect(updatedEnemies).toEqual([enemies[0]]);
  });
});
