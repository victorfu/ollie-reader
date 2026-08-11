import { describe, expect, it } from "vitest";
import {
  advanceMeteorHorizontalMotion,
  getMeteorDashStartDirection,
} from "./meteorGliderPhysics";

const DASH_DURATION = 0.24;
const DASH_SPEED = 480;
const REFRESH_RATES = [30, 60, 120, 144] as const;

function simulate(
  refreshRate: number,
  durationSeconds: number,
  options: {
    velocity?: number;
    targetVelocity: number;
    dashSecondsRemaining?: number;
    queueDash?: boolean;
    startDashDirection?: -1 | 1;
  },
) {
  const frameSeconds = 1 / refreshRate;
  let elapsed = 0;
  let velocity = options.velocity ?? 0;
  let distance = 0;
  let dashSecondsRemaining = options.dashSecondsRemaining ?? 0;
  let dashStartupSecondsRemaining = 0;
  let dashStartupImpulse = 0;
  let queueDash = options.queueDash ?? false;

  while (elapsed < durationSeconds - Number.EPSILON) {
    const delta = Math.min(frameSeconds, durationSeconds - elapsed);
    const motion = advanceMeteorHorizontalMotion({
      velocity,
      targetVelocity: options.targetVelocity,
      deltaSeconds: delta,
      dashSecondsRemaining,
      dashStartupSecondsRemaining,
      dashStartupImpulse,
      dashSpeed: DASH_SPEED,
      startDashSeconds: queueDash ? DASH_DURATION : 0,
      startDashDirection: options.startDashDirection ?? 1,
    });
    velocity = motion.velocity;
    distance += motion.distance;
    dashSecondsRemaining = motion.dashSecondsRemaining;
    dashStartupSecondsRemaining = motion.dashStartupSecondsRemaining;
    dashStartupImpulse = motion.dashStartupImpulse;
    queueDash = false;
    elapsed += delta;
  }

  return {
    velocity,
    distance,
    dashSecondsRemaining,
    dashStartupSecondsRemaining,
    dashStartupImpulse,
  };
}

describe("Meteor Glider horizontal physics", () => {
  it("exactly preserves the legacy normal and dash recurrences at 60 Hz", () => {
    const normal = advanceMeteorHorizontalMotion({
      velocity: 100,
      targetVelocity: 260,
      deltaSeconds: 1 / 60,
      dashSecondsRemaining: 0,
      dashSpeed: DASH_SPEED,
    });
    const legacyNormalVelocity = 100 * 0.9 + (260 - 100) * 0.12;

    expect(normal.velocity).toBeCloseTo(legacyNormalVelocity, 12);
    expect(normal.distance).toBeCloseTo(legacyNormalVelocity / 60, 12);

    const dash = advanceMeteorHorizontalMotion({
      velocity: 100,
      targetVelocity: 260,
      deltaSeconds: 1 / 60,
      dashSecondsRemaining: DASH_DURATION,
      dashSpeed: DASH_SPEED,
    });
    const legacyDashVelocity =
      legacyNormalVelocity * 0.95 + DASH_SPEED * 0.15;

    expect(dash.velocity).toBeCloseTo(legacyDashVelocity, 12);
    expect(dash.distance).toBeCloseTo(legacyDashVelocity / 60, 12);
  });

  it("preserves the queued-dash impulse and displacement on its 60 Hz trigger frame", () => {
    const queuedDash = advanceMeteorHorizontalMotion({
      velocity: 100,
      targetVelocity: 260,
      deltaSeconds: 1 / 60,
      dashSecondsRemaining: 0,
      dashSpeed: DASH_SPEED,
      startDashSeconds: DASH_DURATION,
      startDashDirection: 1,
    });
    const legacyNormalVelocity = 100 * 0.9 + (260 - 100) * 0.12;
    const legacyTriggeredVelocity = legacyNormalVelocity + DASH_SPEED;

    expect(queuedDash.velocity).toBeCloseTo(legacyTriggeredVelocity, 12);
    expect(queuedDash.distance).toBeCloseTo(
      legacyTriggeredVelocity / 60,
      12,
    );
    expect(queuedDash.dashSecondsRemaining).toBe(DASH_DURATION);
    expect(queuedDash.dashStartupSecondsRemaining).toBe(0);
    expect(queuedDash.dashStartupImpulse).toBe(0);
  });

  it("keeps queued-dash startup position continuous as delta approaches zero", () => {
    const epsilon = 1e-9;
    const motion = advanceMeteorHorizontalMotion({
      velocity: 100,
      targetVelocity: 260,
      deltaSeconds: epsilon,
      dashSecondsRemaining: 0,
      dashSpeed: DASH_SPEED,
      startDashSeconds: DASH_DURATION,
      startDashDirection: 1,
    });

    expect(motion.distance).toBeGreaterThan(0);
    expect(motion.distance).toBeLessThan(1e-5);
    expect(motion.dashStartupSecondsRemaining).toBeCloseTo(
      1 / 60 - epsilon,
      12,
    );
    expect(motion.dashStartupImpulse).toBe(DASH_SPEED);
  });

  it.each([120, 144])(
    "composes partial %i Hz startup frames into the legacy 60 Hz endpoint",
    (refreshRate) => {
      const options = {
        velocity: 100,
        targetVelocity: 260,
        queueDash: true,
        startDashDirection: 1 as const,
      };
      const legacyEndpoint = simulate(60, 1 / 60, options);
      const partialEndpoint = simulate(refreshRate, 1 / 60, options);

      expect(partialEndpoint.velocity).toBeCloseTo(
        legacyEndpoint.velocity,
        10,
      );
      expect(partialEndpoint.distance).toBeCloseTo(
        legacyEndpoint.distance,
        10,
      );
      expect(partialEndpoint.dashStartupSecondsRemaining).toBe(0);
      expect(partialEndpoint.dashStartupImpulse).toBe(0);
      expect(partialEndpoint.dashSecondsRemaining).toBe(DASH_DURATION);
    },
  );

  it("uses the legacy post-normal velocity to choose a no-input dash direction", () => {
    expect(getMeteorDashStartDirection(0, 0, -35)).toBe(-1);

    const motion = advanceMeteorHorizontalMotion({
      velocity: 0,
      targetVelocity: -35,
      deltaSeconds: 1 / 60,
      dashSecondsRemaining: 0,
      dashSpeed: DASH_SPEED,
      startDashSeconds: DASH_DURATION,
      startDashDirection: getMeteorDashStartDirection(0, 0, -35),
    });
    const legacyNormalVelocity = -35 * 0.12;

    expect(motion.velocity).toBeCloseTo(
      legacyNormalVelocity - DASH_SPEED,
      12,
    );
  });

  it("re-evaluates active direction after a mixed-direction 30 Hz startup", () => {
    const motion = advanceMeteorHorizontalMotion({
      velocity: 0,
      targetVelocity: -260,
      deltaSeconds: 1 / 30,
      dashSecondsRemaining: 0,
      dashSpeed: DASH_SPEED,
      startDashSeconds: DASH_DURATION,
      startDashDirection: 1,
    });
    const startupVelocity = -260 * 0.12 + DASH_SPEED;
    const activeNormalVelocity =
      startupVelocity * 0.9 + (-260 - startupVelocity) * 0.12;
    const expectedVelocity = activeNormalVelocity * 0.95 - DASH_SPEED * 0.15;
    const expectedDistance =
      (startupVelocity + expectedVelocity) / 60;

    expect(motion.velocity).toBeCloseTo(expectedVelocity, 12);
    expect(motion.distance).toBeCloseTo(expectedDistance, 12);
    expect(motion.dashSecondsRemaining).toBeCloseTo(
      DASH_DURATION - 1 / 60,
      12,
    );
  });

  it("ends active dash at exactly 0.24 seconds before advancing cooldown", () => {
    const trigger = advanceMeteorHorizontalMotion({
      velocity: 0,
      targetVelocity: 260,
      deltaSeconds: 1 / 60,
      dashSecondsRemaining: 0,
      dashSpeed: DASH_SPEED,
      startDashSeconds: DASH_DURATION,
      startDashDirection: 1,
    });
    const boundary = advanceMeteorHorizontalMotion({
      velocity: trigger.velocity,
      targetVelocity: 260,
      deltaSeconds: DASH_DURATION,
      dashSecondsRemaining: trigger.dashSecondsRemaining,
      dashStartupSecondsRemaining: trigger.dashStartupSecondsRemaining,
      dashStartupImpulse: trigger.dashStartupImpulse,
      dashSpeed: DASH_SPEED,
    });
    const afterBoundary = advanceMeteorHorizontalMotion({
      velocity: boundary.velocity,
      targetVelocity: 260,
      deltaSeconds: 1 / 60,
      dashSecondsRemaining: boundary.dashSecondsRemaining,
      dashStartupSecondsRemaining: boundary.dashStartupSecondsRemaining,
      dashStartupImpulse: boundary.dashStartupImpulse,
      dashSpeed: DASH_SPEED,
    });

    expect(boundary.dashSecondsRemaining).toBe(0);
    expect(boundary.cooldownElapsedSeconds).toBe(0);
    expect(afterBoundary.cooldownElapsedSeconds).toBeCloseTo(1 / 60, 12);
  });

  it.each(REFRESH_RATES)(
    "keeps one second of normal movement consistent at %i Hz",
    (refreshRate) => {
      const baseline = simulate(60, 1, { targetVelocity: 260 });
      const result = simulate(refreshRate, 1, { targetVelocity: 260 });

      expect(result.velocity).toBeCloseTo(baseline.velocity, 9);
      expect(result.distance).toBeCloseTo(baseline.distance, 9);
    },
  );

  it.each(REFRESH_RATES)(
    "keeps a 0.24 second dash trajectory consistent at %i Hz",
    (refreshRate) => {
      const options = {
        velocity: DASH_SPEED,
        targetVelocity: 0,
        dashSecondsRemaining: DASH_DURATION,
      };
      const baseline = simulate(60, 1, options);
      const result = simulate(refreshRate, 1, options);

      expect(result.velocity).toBeCloseTo(baseline.velocity, 9);
      expect(result.distance).toBeCloseTo(baseline.distance, 9);
      expect(result.dashSecondsRemaining).toBe(0);
    },
  );

  it.each(REFRESH_RATES)(
    "keeps the complete queued-dash trajectory consistent at %i Hz",
    (refreshRate) => {
      const options = {
        targetVelocity: 260,
        queueDash: true,
        startDashDirection: 1 as const,
      };
      const baseline = simulate(60, 0.5, options);
      const result = simulate(refreshRate, 0.5, options);

      expect(result.velocity).toBeCloseTo(baseline.velocity, 9);
      expect(result.distance).toBeCloseTo(baseline.distance, 9);
      expect(result.dashSecondsRemaining).toBe(0);
      expect(result.dashStartupSecondsRemaining).toBe(0);
    },
  );
});
