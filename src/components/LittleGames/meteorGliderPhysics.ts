const BASELINE_FRAME_SECONDS = 1 / 60;

// The legacy 60 Hz update first applied 0.9 friction, then blended 12% of
// target velocity. Written as one affine recurrence, that is v' = 0.78v + c.
const NORMAL_RETENTION = 0.9 - 0.12;
const NORMAL_TARGET_FORCE = 0.12;

// During a dash the normal update was followed by v' = 0.95v + dash force.
// Combining both updates preserves their exact order at the 60 Hz baseline.
const DASH_RETENTION = 0.95 * NORMAL_RETENTION;
const DASH_TARGET_FORCE = 0.95 * NORMAL_TARGET_FORCE;
const DASH_SPEED_FORCE = 0.15;

type AffineMotion = {
  velocity: number;
  distance: number;
};

export type MeteorHorizontalMotion = AffineMotion & {
  dashSecondsRemaining: number;
  dashStartupSecondsRemaining: number;
  dashStartupImpulse: number;
  cooldownElapsedSeconds: number;
};

export type MeteorHorizontalMotionInput = {
  velocity: number;
  targetVelocity: number;
  deltaSeconds: number;
  dashSecondsRemaining: number;
  dashStartupSecondsRemaining?: number;
  dashStartupImpulse?: number;
  dashSpeed: number;
  startDashSeconds?: number;
  startDashDirection?: -1 | 1;
};

/**
 * Advance a 60 Hz affine velocity recurrence by an arbitrary wall-clock
 * duration. The fractional matrix power keeps both velocity and integrated
 * distance identical to the legacy update whenever delta is 1/60 second.
 */
function advanceAffineMotion(
  velocity: number,
  perFrameRetention: number,
  perFrameForce: number,
  deltaSeconds: number,
): AffineMotion {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return { velocity, distance: 0 };
  }

  const frameCount = deltaSeconds / BASELINE_FRAME_SECONDS;
  const scaledRetention = perFrameRetention ** frameCount;
  const steadyVelocity = perFrameForce / (1 - perFrameRetention);
  const velocityOffset = velocity - steadyVelocity;
  const nextVelocity = steadyVelocity + velocityOffset * scaledRetention;
  const distance =
    BASELINE_FRAME_SECONDS *
    (frameCount * steadyVelocity +
      (velocityOffset *
        perFrameRetention *
        (1 - scaledRetention)) /
        (1 - perFrameRetention));

  return { velocity: nextVelocity, distance };
}

/** Match the legacy queued-dash direction after its normal 60 Hz update. */
export function getMeteorDashStartDirection(
  inputDirection: number,
  velocity: number,
  targetVelocity: number,
): -1 | 1 {
  if (inputDirection !== 0) return Math.sign(inputDirection) as -1 | 1;

  const normalVelocity = advanceAffineMotion(
    velocity,
    NORMAL_RETENTION,
    NORMAL_TARGET_FORCE * targetVelocity,
    BASELINE_FRAME_SECONDS,
  ).velocity;
  return Math.sign(normalVelocity || 1) as -1 | 1;
}

/**
 * Advance Meteor Glider's horizontal motion while keeping the original 60 Hz
 * feel. Active dash time is split at the exact 0.24-second boundary instead of
 * preserving the legacy frame-overshoot; any same-frame remainder resumes
 * normal movement and starts advancing the dash cooldown.
 */
export function advanceMeteorHorizontalMotion(
  input: MeteorHorizontalMotionInput,
): MeteorHorizontalMotion {
  const {
    velocity,
    targetVelocity,
    deltaSeconds,
    dashSecondsRemaining,
    dashSpeed,
  } = input;
  const safeDelta =
    Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  let nextVelocity = velocity;
  let distance = 0;
  let remainingDelta = safeDelta;
  let nextDashSeconds = Math.max(0, dashSecondsRemaining);
  let nextDashStartupSeconds = Math.max(
    0,
    input.dashStartupSecondsRemaining ?? 0,
  );
  let nextDashStartupImpulse =
    nextDashStartupSeconds > 0 ? (input.dashStartupImpulse ?? 0) : 0;

  if ((input.startDashSeconds ?? 0) > 0) {
    // A queued dash adds its impulse immediately, but the legacy trigger frame
    // still contains one normal 60 Hz recurrence before active-dash recurrence
    // begins. Keep the impulse separate while that canonical startup phase is
    // consumed so partial frames compose without pre-jumping position.
    nextDashStartupImpulse =
      (input.startDashDirection ?? 1) * dashSpeed;
    nextVelocity += nextDashStartupImpulse;
    nextDashSeconds = Math.max(0, input.startDashSeconds ?? 0);
    nextDashStartupSeconds = BASELINE_FRAME_SECONDS;
  }

  if (nextDashStartupSeconds > 0 && remainingDelta > 0) {
    const startupDelta = Math.min(nextDashStartupSeconds, remainingDelta);
    const baseVelocity = nextVelocity - nextDashStartupImpulse;
    const startupMotion = advanceAffineMotion(
      baseVelocity,
      NORMAL_RETENTION,
      NORMAL_TARGET_FORCE * targetVelocity,
      startupDelta,
    );
    nextVelocity = startupMotion.velocity + nextDashStartupImpulse;
    distance +=
      startupMotion.distance + nextDashStartupImpulse * startupDelta;
    nextDashStartupSeconds = Math.max(
      0,
      nextDashStartupSeconds - startupDelta,
    );
    remainingDelta -= startupDelta;
    if (nextDashStartupSeconds === 0) nextDashStartupImpulse = 0;
  }

  if (
    nextDashStartupSeconds === 0 &&
    nextDashSeconds > 0 &&
    remainingDelta > 0
  ) {
    const activeDelta = Math.min(nextDashSeconds, remainingDelta);
    const activeDashDirection = Math.sign(
      targetVelocity || nextVelocity || 1,
    ) as -1 | 1;
    const dashMotion = advanceAffineMotion(
      nextVelocity,
      DASH_RETENTION,
      DASH_TARGET_FORCE * targetVelocity +
        DASH_SPEED_FORCE * activeDashDirection * dashSpeed,
      activeDelta,
    );
    nextVelocity = dashMotion.velocity;
    distance += dashMotion.distance;
    nextDashSeconds = Math.max(0, nextDashSeconds - activeDelta);
    remainingDelta -= activeDelta;
  }

  const cooldownElapsedSeconds = remainingDelta;
  if (remainingDelta > 0) {
    const normalMotion = advanceAffineMotion(
      nextVelocity,
      NORMAL_RETENTION,
      NORMAL_TARGET_FORCE * targetVelocity,
      remainingDelta,
    );
    nextVelocity = normalMotion.velocity;
    distance += normalMotion.distance;
  }

  return {
    velocity: nextVelocity,
    distance,
    dashSecondsRemaining: nextDashSeconds,
    dashStartupSecondsRemaining: nextDashStartupSeconds,
    dashStartupImpulse: nextDashStartupImpulse,
    cooldownElapsedSeconds,
  };
}
