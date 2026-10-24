import type { PetEvent } from "./petMachine";

export type PointerSample = {
  pointerId: number;
  /** Client px. */
  x: number;
  y: number;
  /** The ray hits the head (not ears, body or background). */
  onHead: boolean;
  now: number;
  /** Head radius on screen in px, so strokes are measured in head radii. */
  headRadiusPx: number;
};

/** Drag to turn the model, in client px. */
export type TurnEvent =
  | { type: "turn"; now: number; dx: number; dy: number }
  | { type: "turnEnd"; now: number };

export type TrackerEvent = PetEvent | TurnEvent;

export type PointerTracker = {
  down(sample: PointerSample): { capture: boolean; events: TrackerEvent[] };
  move(sample: PointerSample): TrackerEvent[];
  end(pointerId: number, now: number): TrackerEvent[];
  reset(now: number): TrackerEvent[];
};

/** Movement a press off the head needs before it starts turning. */
const TURN_SLOP_PX = 6;

/**
 * Turns raw pointer events into petting and turning. Where a press starts
 * decides what the whole drag does: on the head it pets, anywhere else it
 * turns the model, and crossing the head or sliding off it never switches.
 *
 * Follows one pointer at a time: a second finger is ignored until the first
 * one lifts, and a petting pointer that slides off the head stops counting
 * until it slides back on.
 */
export function createPointerTracker(): PointerTracker {
  let active: number | null = null;
  let mode: "pet" | "turn" = "pet";
  let onHead = false;
  let turning = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  const release = (now: number): TrackerEvent[] => {
    const events: TrackerEvent[] = [];
    if (mode === "pet" && onHead) events.push({ type: "touchEnd", now });
    if (mode === "turn" && turning) events.push({ type: "turnEnd", now });
    active = null;
    onHead = false;
    turning = false;
    return events;
  };

  const moveTurn = (sample: PointerSample): TrackerEvent[] => {
    if (!turning) {
      if (Math.hypot(sample.x - startX, sample.y - startY) < TURN_SLOP_PX) return [];
      turning = true;
      lastX = startX;
      lastY = startY;
    }
    const dx = sample.x - lastX;
    const dy = sample.y - lastY;
    lastX = sample.x;
    lastY = sample.y;
    return [{ type: "turn", now: sample.now, dx, dy }];
  };

  const movePet = (sample: PointerSample): TrackerEvent[] => {
    const wasOnHead = onHead;
    onHead = sample.onHead;
    const dx = (sample.x - lastX) / sample.headRadiusPx;
    const dy = (sample.y - lastY) / sample.headRadiusPx;
    lastX = sample.x;
    lastY = sample.y;

    if (!wasOnHead) {
      return onHead ? [{ type: "touchStart", now: sample.now }] : [];
    }
    if (!onHead) return [{ type: "touchEnd", now: sample.now }];
    return [{ type: "stroke", now: sample.now, dx, dy }];
  };

  return {
    down(sample) {
      if (active !== null) return { capture: false, events: [] };
      active = sample.pointerId;
      startX = lastX = sample.x;
      startY = lastY = sample.y;
      if (!sample.onHead) {
        mode = "turn";
        turning = false;
        return { capture: true, events: [] };
      }
      mode = "pet";
      onHead = true;
      return { capture: true, events: [{ type: "touchStart", now: sample.now }] };
    },

    move(sample) {
      if (sample.pointerId !== active) return [];
      return mode === "turn" ? moveTurn(sample) : movePet(sample);
    },

    end(pointerId, now) {
      return pointerId === active ? release(now) : [];
    },

    reset(now) {
      return active === null ? [] : release(now);
    },
  };
}
