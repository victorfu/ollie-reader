import { Quaternion, Vector3 } from "three";

/**
 * Trackball rotation for the model: a sideways drag turns it about the
 * screen's vertical axis and an up-down drag tips it about the horizontal
 * axis, so it can go all the way round in any direction. Follows the drag
 * exactly while held, coasts after a flick and slows down by itself.
 */
export type Spin = {
  orientation: Quaternion;
  /** Radians per second about the vertical (x) and horizontal (y) axes. */
  velocity: { x: number; y: number };
  dragging: boolean;
  lastTurnAt: number;
};

/** A pause longer than this before letting go means "stop here". */
const HOLD_BEFORE_RELEASE_MS = 80;
/** Exponential slowdown per second while coasting. */
const FRICTION = 2.2;
const MAX_VELOCITY = 12;
const MIN_VELOCITY = 0.05;

const VERTICAL = new Vector3(0, 1, 0);
const HORIZONTAL = new Vector3(1, 0, 0);

function rotate(orientation: Quaternion, aboutVertical: number, aboutHorizontal: number) {
  const turn = new Quaternion().setFromAxisAngle(VERTICAL, aboutVertical);
  const tip = new Quaternion().setFromAxisAngle(HORIZONTAL, aboutHorizontal);
  // World axes: premultiply so drags always follow the screen.
  return orientation.clone().premultiply(turn).premultiply(tip).normalize();
}

const clampVelocity = (v: number) => Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v));

export function createSpin(): Spin {
  return {
    orientation: new Quaternion(),
    velocity: { x: 0, y: 0 },
    dragging: false,
    lastTurnAt: 0,
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
    orientation: rotate(spin.orientation, aboutVertical, aboutHorizontal),
    velocity: {
      x: blend(spin.velocity.x, aboutVertical),
      y: blend(spin.velocity.y, aboutHorizontal),
    },
    dragging: true,
    lastTurnAt: now,
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

export function advanceSpin(spin: Spin, seconds: number): Spin {
  const { x, y } = spin.velocity;
  if (spin.dragging || (x === 0 && y === 0)) return spin;
  const decay = Math.exp(-FRICTION * seconds);
  const settle = (v: number) => (Math.abs(v * decay) < MIN_VELOCITY ? 0 : v * decay);
  return {
    ...spin,
    orientation: rotate(spin.orientation, x * seconds, y * seconds),
    velocity: { x: settle(x), y: settle(y) },
  };
}
