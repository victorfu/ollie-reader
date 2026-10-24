import { Quaternion, Vector3 } from "three";

/**
 * Turntable rotation for the model: a sideways drag turns it about its own
 * vertical axis (yaw) and an up-down drag tips it forward or back (pitch),
 * each all the way round. Keeping just these two angles means the head never
 * leans sideways, and undoing the drags in any order returns it to where it
 * started; free trackball rotation built up roll and went crooked. Follows
 * the drag exactly while held, coasts after a flick and slows down by itself.
 */
export type Spin = {
  /** Turn about the model's own vertical axis, radians. */
  yaw: number;
  /** Tip toward (positive) or away from the viewer, radians. */
  pitch: number;
  /** Rotation for the scene, derived from yaw and pitch. */
  orientation: Quaternion;
  /** Radians per second about the vertical (x) and horizontal (y) axes. */
  velocity: { x: number; y: number };
  dragging: boolean;
  lastTurnAt: number;
  /** Easing back to upright and facing front after a reset. */
  homing: boolean;
};

/** A pause longer than this before letting go means "stop here". */
const HOLD_BEFORE_RELEASE_MS = 80;
/** Exponential slowdown per second while coasting. */
const FRICTION = 2.2;
const MAX_VELOCITY = 12;
const MIN_VELOCITY = 0.05;
/** How quickly a reset eases home, per second. */
const HOMING_RATE = 8;

const VERTICAL = new Vector3(0, 1, 0);
const HORIZONTAL = new Vector3(1, 0, 0);

/** Tip about the screen's horizontal axis after turning about the model's own vertical. */
function orientationFor(yaw: number, pitch: number): Quaternion {
  return new Quaternion()
    .setFromAxisAngle(HORIZONTAL, pitch)
    .multiply(new Quaternion().setFromAxisAngle(VERTICAL, yaw));
}

function rotate(
  spin: Spin,
  aboutVertical: number,
  aboutHorizontal: number,
): Pick<Spin, "yaw" | "pitch" | "orientation"> {
  // Upside down the model's own vertical points down, so turn the other way
  // to keep the side facing the viewer moving with the finger.
  const facing = Math.cos(spin.pitch) < 0 ? -1 : 1;
  const yaw = spin.yaw + aboutVertical * facing;
  const pitch = spin.pitch + aboutHorizontal;
  return { yaw, pitch, orientation: orientationFor(yaw, pitch) };
}

const clampVelocity = (v: number) => Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v));

export function createSpin(): Spin {
  return {
    yaw: 0,
    pitch: 0,
    orientation: new Quaternion(),
    velocity: { x: 0, y: 0 },
    dragging: false,
    lastTurnAt: 0,
    homing: false,
  };
}

/**
 * Rotates by a drag step: `aboutVertical` from sideways movement (positive
 * turns the face right), `aboutHorizontal` from vertical movement (positive
 * tips the top toward the viewer).
 */
export function turnSpin(
  spin: Spin,
  aboutVertical: number,
  aboutHorizontal: number,
  now: number,
): Spin {
  const elapsed = (now - spin.lastTurnAt) / 1_000;
  const measuring = spin.dragging && elapsed > 0 && elapsed < 0.1;
  const blend = (previous: number, step: number) =>
    measuring ? 0.6 * (step / elapsed) + 0.4 * previous : 0;
  return {
    ...rotate(spin, aboutVertical, aboutHorizontal),
    velocity: {
      x: blend(spin.velocity.x, aboutVertical),
      y: blend(spin.velocity.y, aboutHorizontal),
    },
    dragging: true,
    lastTurnAt: now,
    homing: false,
  };
}

export function releaseSpin(spin: Spin, now: number): Spin {
  const held = now - spin.lastTurnAt > HOLD_BEFORE_RELEASE_MS;
  return {
    ...spin,
    dragging: false,
    velocity: held
      ? { x: 0, y: 0 }
      : { x: clampVelocity(spin.velocity.x), y: clampVelocity(spin.velocity.y) },
  };
}

/** Eases back to upright and facing the viewer, the short way round. */
export function resetSpin(spin: Spin): Spin {
  return { ...spin, velocity: { x: 0, y: 0 }, homing: true };
}

const TURN = Math.PI * 2;
const nearestUpright = (angle: number) => Math.round(angle / TURN) * TURN;

function home(spin: Spin, seconds: number): Spin {
  const ease = 1 - Math.exp(-HOMING_RATE * seconds);
  const targetYaw = nearestUpright(spin.yaw);
  const targetPitch = nearestUpright(spin.pitch);
  let yaw = spin.yaw + (targetYaw - spin.yaw) * ease;
  let pitch = spin.pitch + (targetPitch - spin.pitch) * ease;
  const arrived = Math.abs(targetYaw - yaw) < 1e-4 && Math.abs(targetPitch - pitch) < 1e-4;
  if (arrived) {
    yaw = 0;
    pitch = 0;
  }
  return { ...spin, yaw, pitch, orientation: orientationFor(yaw, pitch), homing: !arrived };
}

export function advanceSpin(spin: Spin, seconds: number): Spin {
  if (spin.homing && !spin.dragging) return home(spin, seconds);
  const { x, y } = spin.velocity;
  if (spin.dragging || (x === 0 && y === 0)) return spin;
  const decay = Math.exp(-FRICTION * seconds);
  const settle = (v: number) => (Math.abs(v * decay) < MIN_VELOCITY ? 0 : v * decay);
  return {
    ...spin,
    ...rotate(spin, x * seconds, y * seconds),
    velocity: { x: settle(x), y: settle(y) },
  };
}
