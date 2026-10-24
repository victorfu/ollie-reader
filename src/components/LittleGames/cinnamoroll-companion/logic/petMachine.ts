/**
 * Petting state machine: idle → headTouch → petting → happyRelease → idle.
 *
 * Pure and time-driven so the render loop can feed it pointer events and
 * frame ticks without React re-rendering. Movement is measured in head radii
 * (screen px divided by the head's on-screen radius), which keeps the feel the
 * same on a phone and a large monitor.
 */

export type PetPhase = "idle" | "headTouch" | "petting" | "happyRelease";

export type PetEvent =
  | { type: "touchStart"; now: number }
  /** Pointer movement on the head, in head radii. */
  | { type: "stroke"; now: number; dx: number; dy: number }
  | { type: "touchEnd"; now: number }
  /** Keyboard / button stand-in for a short pet. */
  | { type: "pat"; now: number }
  | { type: "tick"; now: number };

export type PetState = {
  phase: PetPhase;
  since: number;
  /** A pointer is currently on the head. */
  contact: boolean;
  /** Stroke distance in the current touch, before it counts as petting. */
  travel: number;
  /** Time of the previous stroke event, used to measure speed. */
  lastMoveAt: number;
  /** Time of the last stroke fast enough to count as petting. */
  lastStrokeAt: number;
  /** Continuous stroking time in this petting session. */
  strokeTime: number;
  /** Monotonic counter; the scene spawns one heart per increment. */
  hearts: number;
  lastHeartAt: number;
  /** happyRelease ends here. */
  holdUntil: number;
  /** A touch within happyRelease picks petting back up instead of restarting. */
  resumable: boolean;
  /** Keyboard pats release themselves at this time. */
  patUntil: number | null;
};

export type PetExpression = {
  /** 0 open, 1 closed into happy arcs. */
  eyesClosed: number;
  smile: number;
  /** Look-up reaction to a fresh touch. */
  headLift: number;
  /** 0–1, grows with sustained petting; drives blush and ear wiggle. */
  delight: number;
};

/** Head radii of stroking before a touch counts as petting. */
const PET_START_TRAVEL = 0.35;
/** Slower movement is a resting or trembling finger, not a stroke. */
const MIN_STROKE_SPEED = 0.8 / 1_000;
/** Gaps longer than this between strokes are not continuous stroking. */
const STROKE_GAP_MS = 250;
/** Petting relaxes back to a light touch after this long without strokes. */
const PETTING_GRACE_MS = 700;
const DELIGHT_AFTER_MS = 1_200;
const HEART_COOLDOWN_MS = 1_000;
const TAP_HOLD_MS = 700;
const PET_HOLD_MS = 1_400;
const PAT_MS = 900;
/** Stroking time one pat is worth; key repeat cannot buy more. */
const PAT_CREDIT_MS = 500;

export function createPetState(now: number): PetState {
  return {
    phase: "idle",
    since: now,
    contact: false,
    travel: 0,
    lastMoveAt: now,
    lastStrokeAt: now,
    strokeTime: 0,
    hearts: 0,
    lastHeartAt: -Infinity,
    holdUntil: now,
    resumable: false,
    patUntil: null,
  };
}

function creditStroking(
  state: PetState,
  now: number,
  credit: number,
): PetState {
  const strokeTime = state.strokeTime + credit;
  const earnsHeart =
    strokeTime >= DELIGHT_AFTER_MS &&
    now - state.lastHeartAt >= HEART_COOLDOWN_MS;
  return {
    ...state,
    strokeTime,
    lastStrokeAt: now,
    hearts: earnsHeart ? state.hearts + 1 : state.hearts,
    lastHeartAt: earnsHeart ? now : state.lastHeartAt,
  };
}

function release(state: PetState, now: number): PetState {
  const fromPetting = state.phase === "petting";
  return {
    ...state,
    phase: "happyRelease",
    since: now,
    contact: false,
    holdUntil: now + (fromPetting ? PET_HOLD_MS : TAP_HOLD_MS),
    resumable: fromPetting,
    patUntil: null,
  };
}

function touchStart(state: PetState, now: number): PetState {
  if (state.contact) return state;
  const resume = state.phase === "happyRelease" && state.resumable;
  return {
    ...state,
    phase: resume ? "petting" : "headTouch",
    since: now,
    contact: true,
    travel: 0,
    lastMoveAt: now,
    lastStrokeAt: now,
    strokeTime: resume ? state.strokeTime : 0,
    resumable: false,
    patUntil: null,
  };
}

function stroke(
  state: PetState,
  now: number,
  dx: number,
  dy: number,
): PetState {
  if (!state.contact) return state;
  const distance = Math.hypot(dx, dy);
  const elapsed = now - state.lastMoveAt;
  const moved = { ...state, lastMoveAt: now };
  if (elapsed <= 0 || distance / elapsed < MIN_STROKE_SPEED) return moved;

  if (state.phase === "headTouch") {
    const travel = state.travel + distance;
    if (travel < PET_START_TRAVEL) return { ...moved, travel };
    return {
      ...moved,
      phase: "petting",
      since: now,
      travel,
      lastStrokeAt: now,
      strokeTime: 0,
    };
  }

  if (state.phase === "petting") {
    const gap = now - state.lastStrokeAt;
    return creditStroking(moved, now, gap <= STROKE_GAP_MS ? gap : 0);
  }

  return moved;
}

function pat(state: PetState, now: number): PetState {
  if (state.contact) return state;
  if (state.phase === "petting") {
    const credited = creditStroking(
      state,
      now,
      Math.min(now - state.lastStrokeAt, PAT_CREDIT_MS),
    );
    return { ...credited, patUntil: now + PAT_MS };
  }
  const resume = state.phase === "happyRelease" && state.resumable;
  return {
    ...state,
    phase: "petting",
    since: now,
    lastStrokeAt: now,
    strokeTime: resume ? state.strokeTime : 0,
    resumable: false,
    patUntil: now + PAT_MS,
  };
}

function tick(state: PetState, now: number): PetState {
  if (state.phase === "petting") {
    if (state.contact && now - state.lastStrokeAt > PETTING_GRACE_MS) {
      return {
        ...state,
        phase: "headTouch",
        since: now,
        travel: 0,
        strokeTime: 0,
      };
    }
    if (!state.contact && state.patUntil !== null && now >= state.patUntil) {
      return release(state, now);
    }
    return state;
  }

  if (state.phase === "happyRelease" && now >= state.holdUntil) {
    return {
      ...state,
      phase: "idle",
      since: now,
      strokeTime: 0,
      resumable: false,
    };
  }

  return state;
}

export function reducePet(state: PetState, event: PetEvent): PetState {
  switch (event.type) {
    case "touchStart":
      return touchStart(state, event.now);
    case "stroke":
      return stroke(state, event.now, event.dx, event.dy);
    case "touchEnd":
      return state.contact ? release(state, event.now) : state;
    case "pat":
      return pat(state, event.now);
    case "tick":
      return tick(state, event.now);
  }
}

function delightOf(state: PetState): number {
  return Math.min(1, state.strokeTime / DELIGHT_AFTER_MS);
}

/** Target face for the animation layer, which eases toward it every frame. */
export function petExpression(state: PetState, now: number): PetExpression {
  switch (state.phase) {
    case "idle":
      return { eyesClosed: 0, smile: 0.25, headLift: 0, delight: 0 };
    case "headTouch":
      return { eyesClosed: 0, smile: 0.7, headLift: 1, delight: 0 };
    case "petting": {
      const delight = delightOf(state);
      return {
        eyesClosed: 1,
        smile: 0.85 + 0.15 * delight,
        headLift: 0,
        delight,
      };
    }
    case "happyRelease": {
      const hold = state.resumable ? PET_HOLD_MS : TAP_HOLD_MS;
      const remaining = Math.max(0, state.holdUntil - now) / hold;
      return {
        eyesClosed: state.resumable ? 1 : 0,
        smile: 0.9,
        headLift: state.resumable ? 0 : 0.5,
        delight: delightOf(state) * remaining,
      };
    }
  }
}
