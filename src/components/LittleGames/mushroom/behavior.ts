import { GRAVITY, JUMP_SPEED } from "./constants";
import type { Enemy } from "./types";

export type JumpInput = {
  jump: boolean;
  jumpQueued: boolean;
};

export type JumpingPlayer = {
  vy: number;
  onGround: boolean;
  jumps: number;
};

export function pressJump(input: JumpInput) {
  if (!input.jump) input.jumpQueued = true;
  input.jump = true;
}

export function releaseJump(input: JumpInput) {
  input.jump = false;
}

export function clearJumpInput(input: JumpInput) {
  input.jump = false;
  input.jumpQueued = false;
}

export function consumePlayerJump(
  input: JumpInput,
  player: JumpingPlayer,
  canDoubleJump: boolean,
) {
  const jumpPressed = input.jumpQueued;
  input.jumpQueued = false;
  if (!jumpPressed) return false;

  if (player.onGround) {
    player.vy = -JUMP_SPEED;
    player.onGround = false;
    player.jumps = 1;
    return true;
  }

  if (canDoubleJump && player.jumps < 2) {
    player.vy = -JUMP_SPEED * 0.9;
    player.jumps += 1;
    return true;
  }

  return false;
}

export function advanceEnemyVerticalMotion(
  enemy: Enemy,
  playerCenterX: number,
  dt: number,
  random: () => number = Math.random,
): asserts enemy is Enemy & { vy: number } {
  if (enemy.type === "jumper") {
    enemy.jumpTimer = (enemy.jumpTimer ?? 0) - dt;
    // Landing resolves vy to zero at the end of the previous frame. Decide
    // whether to jump before applying this frame's gravity so a resting jumper
    // is not made airborne before its timer check.
    if (enemy.jumpTimer <= 0 && (enemy.vy ?? 0) === 0) {
      enemy.vy = -650;
      enemy.jumpTimer = 1 + random();
      const enemyCenterX = enemy.x + enemy.w / 2;
      if (Math.abs(playerCenterX - enemyCenterX) < 400) {
        enemy.dir = playerCenterX > enemyCenterX ? 1 : -1;
      }
    }
  }

  enemy.vy = (enemy.vy ?? 0) + GRAVITY * dt;
  enemy.y += enemy.vy * dt;
}
