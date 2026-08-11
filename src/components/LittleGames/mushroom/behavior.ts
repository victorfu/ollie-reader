import { BASE_SPEED, GRAVITY, JUMP_SPEED } from "./constants";
import type { Enemy } from "./types";

const REFERENCE_FRAME_RATE = 60;
const REFERENCE_FRAME_SECONDS = 1 / REFERENCE_FRAME_RATE;
const HORIZONTAL_RETENTION_PER_REFERENCE_FRAME = 0.9;
const PLAYER_BASE_MAX_SPEED = 500;

export type JumpInput = {
  jump: boolean;
  jumpQueued: boolean;
};

export type JumpingPlayer = {
  vy: number;
  onGround: boolean;
  jumps: number;
};

export type HorizontallyMovingPlayer = {
  x: number;
  vx: number;
};

export type MushroomComboState = {
  comboCount: number;
  lastStompTime: number;
};

export function keepPlayerInsideWorldStart(
  player: HorizontallyMovingPlayer,
): void {
  if (player.x >= 0) return;
  player.x = 0;
  if (player.vx < 0) player.vx = 0;
}

export function expireMushroomCombo(
  combo: MushroomComboState,
  nowSeconds: number,
  windowSeconds: number,
): void {
  if (
    combo.comboCount > 0 &&
    nowSeconds - combo.lastStompTime > windowSeconds
  ) {
    combo.comboCount = 0;
  }
}

export function registerMushroomComboHit(
  combo: MushroomComboState,
  nowSeconds: number,
  windowSeconds: number,
): number {
  if (
    combo.comboCount > 0 &&
    nowSeconds - combo.lastStompTime <= windowSeconds
  ) {
    combo.comboCount += 1;
  } else {
    combo.comboCount = 1;
  }
  combo.lastStompTime = nowSeconds;
  return combo.comboCount;
}

export type EnemyContactPlayer = {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
};

type EnemyFrameCallbacks = {
  updateEnemy: (enemy: Enemy) => void;
  isPlayerInvincible: () => boolean;
  defeatEnemy: (enemy: Enemy) => void;
  hitPlayer: () => boolean;
};

/**
 * Advance horizontal motion with the existing 60 Hz curve as the reference.
 *
 * The old update mixed a per-frame 0.9 retention with dt-scaled acceleration,
 * so higher refresh rates converged on a lower speed. This is the fractional
 * form of that same 60 Hz affine update; one 60 Hz step remains bit-for-bit
 * equivalent while smaller steps compose to the same velocity and distance.
 */
export function advancePlayerHorizontalMotion(
  player: HorizontallyMovingPlayer,
  move: number,
  speedBoost: number,
  dt: number,
): void {
  if (dt <= 0) return;

  const speedScale = 1 + speedBoost;
  const maxSpeed = PLAYER_BASE_MAX_SPEED * speedScale;
  const normalizedFrames = dt * REFERENCE_FRAME_RATE;
  const retention = Math.pow(
    HORIZONTAL_RETENTION_PER_REFERENCE_FRAME,
    normalizedFrames,
  );
  const accelerationAtReferenceFrame =
    BASE_SPEED * speedScale * REFERENCE_FRAME_SECONDS * 10;
  const targetVelocity =
    (move * accelerationAtReferenceFrame) /
    (1 - HORIZONTAL_RETENTION_PER_REFERENCE_FRAME);
  const previousVelocity = player.vx;
  let effectivePreviousVelocity = previousVelocity;
  let minimumVelocity = -maxSpeed;
  let maximumVelocity = maxSpeed;
  let minimumDisplacement = -maxSpeed * dt;
  let maximumDisplacement = maxSpeed * dt;

  // A speed boost can expire while vx is still above the newly reduced cap.
  // Clamping each fractional frame directly to maxSpeed would make 120 Hz
  // decay twice before the equivalent 60 Hz frame finishes. Project that
  // over-cap velocity onto the preimage of the canonical 60 Hz clamp instead,
  // then allow only this transition step to interpolate outside the new cap.
  // This makes fractional calls compose without carrying hidden frame state.
  if (previousVelocity > maxSpeed && targetVelocity <= maxSpeed) {
    const upperClampPreimage =
      targetVelocity +
      (maxSpeed - targetVelocity) /
        HORIZONTAL_RETENTION_PER_REFERENCE_FRAME;
    effectivePreviousVelocity = Math.min(
      previousVelocity,
      upperClampPreimage,
    );
    maximumVelocity = Number.POSITIVE_INFINITY;
    maximumDisplacement = Number.POSITIVE_INFINITY;
  } else if (
    previousVelocity < -maxSpeed &&
    targetVelocity >= -maxSpeed
  ) {
    const lowerClampPreimage =
      targetVelocity +
      (-maxSpeed - targetVelocity) /
        HORIZONTAL_RETENTION_PER_REFERENCE_FRAME;
    effectivePreviousVelocity = Math.max(
      previousVelocity,
      lowerClampPreimage,
    );
    minimumVelocity = Number.NEGATIVE_INFINITY;
    minimumDisplacement = Number.NEGATIVE_INFINITY;
  }

  const nextVelocity =
    targetVelocity +
    (effectivePreviousVelocity - targetVelocity) * retention;

  // Fractional sum of the 60 Hz semi-implicit displacement. At exactly 60 Hz
  // this reduces to nextVelocity * dt, preserving the established feel.
  const displacement =
    REFERENCE_FRAME_SECONDS *
    (normalizedFrames * targetVelocity +
      ((effectivePreviousVelocity - targetVelocity) *
        HORIZONTAL_RETENTION_PER_REFERENCE_FRAME *
        (1 - retention)) /
        (1 - HORIZONTAL_RETENTION_PER_REFERENCE_FRAME));

  player.vx = Math.max(
    minimumVelocity,
    Math.min(maximumVelocity, nextVelocity),
  );
  player.x += Math.max(
    minimumDisplacement,
    Math.min(maximumDisplacement, displacement),
  );
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Update enemies in order and stop the frame as soon as a damaging contact
 * respawns or kills the player. Returning true tells the caller not to run
 * coins, power-ups, timers, camera, or win/fall checks with stale player data.
 */
export function updateEnemiesUntilPlayerFrameEnds(
  player: EnemyContactPlayer,
  enemies: Enemy[],
  callbacks: EnemyFrameCallbacks,
): boolean {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    callbacks.updateEnemy(enemy);
    if (!enemy.alive || !overlaps(player, enemy)) continue;

    const stomp =
      player.vy > 120 && player.y + player.h - enemy.y < 26;
    if (
      (stomp && enemy.type !== "spiked") ||
      callbacks.isPlayerInvincible()
    ) {
      callbacks.defeatEnemy(enemy);
      continue;
    }

    if (callbacks.hitPlayer()) return true;
  }

  return false;
}

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
