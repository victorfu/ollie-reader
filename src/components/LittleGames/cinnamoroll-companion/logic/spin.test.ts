import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { advanceSpin, createSpin, releaseSpin, turnSpin, type Spin } from "./spin";

/** Steps the spin in 60 fps frames for the given seconds. */
function coast(spin: Spin, seconds: number): Spin {
  let current = spin;
  for (let t = 0; t < seconds; t += 1 / 60) current = advanceSpin(current, 1 / 60);
  return current;
}

/** Where the model's front (+z) points after the spin. */
const front = (spin: Spin) => new Vector3(0, 0, 1).applyQuaternion(spin.orientation);
const top = (spin: Spin) => new Vector3(0, 1, 0).applyQuaternion(spin.orientation);

function expectVector(actual: Vector3, x: number, y: number, z: number) {
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
  expect(actual.z).toBeCloseTo(z, 6);
}

describe("spin", () => {
  it("turns around the vertical axis for a sideways drag", () => {
    const spin = turnSpin(createSpin(), Math.PI / 2, 0, 0);

    // Dragging right swings the face toward the right.
    expectVector(front(spin), 1, 0, 0);
    expectVector(top(spin), 0, 1, 0);
  });

  it("tips forward and back for an up-down drag", () => {
    const spin = turnSpin(createSpin(), 0, Math.PI / 2, 0);

    // Dragging down brings the top of the head toward the viewer.
    expectVector(top(spin), 0, 0, 1);
    expectVector(front(spin), 0, -1, 0);
  });

  it("goes all the way round in either direction", () => {
    let sideways = createSpin();
    let vertical = createSpin();
    for (let i = 0; i < 4; i += 1) {
      sideways = turnSpin(sideways, Math.PI / 2, 0, i * 16);
      vertical = turnSpin(vertical, 0, Math.PI / 2, i * 16);
    }

    expectVector(front(sideways), 0, 0, 1);
    expectVector(front(vertical), 0, 0, 1);
    expectVector(top(vertical), 0, 1, 0);
  });

  it("keeps sideways drags about the screen's vertical even when upside down", () => {
    let spin = turnSpin(createSpin(), 0, Math.PI, 0);
    const before = front(spin);
    spin = turnSpin(spin, 0.7, 0, 16);

    expect(front(spin).y).toBeCloseTo(before.y, 6);
    expect(front(spin).distanceTo(before)).toBeGreaterThan(0.1);
  });

  it("follows the drag exactly while held", () => {
    let spin = createSpin();
    spin = turnSpin(spin, 0.3, 0, 0);
    spin = turnSpin(spin, 0.2, 0, 16);
    const held = front(spin);

    expect(held.x).toBeCloseTo(Math.sin(0.5), 6);
    // No coasting while the finger is still down.
    expect(front(coast(spin, 1)).distanceTo(held)).toBeLessThan(1e-9);
  });

  it("keeps turning after a flick and slows to a stop", () => {
    let spin = createSpin();
    spin = turnSpin(spin, 0.1, 0.05, 0);
    spin = turnSpin(spin, 0.1, 0.05, 16);
    spin = turnSpin(spin, 0.1, 0.05, 32);
    spin = releaseSpin(spin, 40);

    const start = front(spin);
    const firstSecond = coast(spin, 1);
    const settled = coast(firstSecond, 12);

    expect(front(firstSecond).distanceTo(start)).toBeGreaterThan(0.3);
    expect(settled.velocity).toEqual({ x: 0, y: 0 });
    expect(front(coast(settled, 1)).distanceTo(front(settled))).toBeLessThan(1e-9);
  });

  it("does not drift when let go after holding still", () => {
    let spin = createSpin();
    spin = turnSpin(spin, 0.1, 0, 0);
    spin = turnSpin(spin, 0.1, 0, 16);
    spin = releaseSpin(spin, 400);

    expect(front(coast(spin, 1)).distanceTo(front(spin))).toBeLessThan(1e-9);
  });
});
