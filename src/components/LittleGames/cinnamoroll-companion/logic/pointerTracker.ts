import type { PetEvent } from "./petMachine";
import type { CompanionAction } from "../../../../types/companion";

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
  part?: CompanionAction;
  petting?: boolean;
};

/** Drag to turn the model, in client px. */
export type TurnEvent =
  | { type: "turn"; now: number; dx: number; dy: number }
  | { type: "turnEnd"; now: number };

export type TrackerEvent = PetEvent | TurnEvent | { type: "perform"; action: CompanionAction; now: number };

export type PointerTracker = {
  down(sample: PointerSample): { capture: boolean; events: TrackerEvent[] };
  move(sample: PointerSample): TrackerEvent[];
  end(pointerId: number, now: number, cancelled?: boolean): TrackerEvent[];
  reset(now: number): TrackerEvent[];
};

/** Movement a tap needs before it becomes a turn. */
const TURN_SLOP_PX = 6;

/**
 * Taps on the head pat; drags turn regardless of their starting target.
 * Explicit petting samples also support head/ear strokes for legacy callers.
 * Tracks one pointer at a time and never turns a drag back into a tap.
 */
export function createPointerTracker(): PointerTracker {
  let active: number | null = null;
  let mode: "pet" | "turn" | "ear" = "pet";
  let part: CompanionAction | undefined;
  let headTap = false;
  let lastReaction = -Infinity;
  let stroked = false;
  let moved = false;
  let onHead = false;
  let turning = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  const release = (now: number, cancelled = false): TrackerEvent[] => {
    const events: TrackerEvent[] = [];
    if (mode === "pet" && onHead) events.push({ type: "touchEnd", now });
    if (mode === "turn" && turning) events.push({ type: "turnEnd", now });
    if (!cancelled && part && !turning && !stroked && !moved) events.push({ type: "perform", action: part, now });
    if (!cancelled && headTap && !turning && !moved) events.push({ type: "pat", now });
    headTap = false;
    active = null;
    onHead = false;
    turning = false;
    part = undefined;
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
      part = sample.part;
      headTap = sample.onHead && !sample.petting;
      stroked = false;
      moved = false;
      lastReaction = -Infinity;
      if (sample.petting && (part === "leftEar" || part === "rightEar")) {
        mode = "ear";
        return { capture: true, events: [] };
      }
      if (!sample.onHead || !sample.petting) {
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
      if (Math.hypot(sample.x - startX, sample.y - startY) >= TURN_SLOP_PX) moved = true;
      if (mode === "ear") {
        if (sample.part === part && Math.hypot(sample.x - lastX, sample.y - lastY) >= TURN_SLOP_PX && sample.now - lastReaction >= 500) {
          lastX = sample.x;
          lastY = sample.y;
          lastReaction = sample.now;
          stroked = true;
          return [{ type: "perform", action: part!, now: sample.now }];
        }
        return [];
      }
      return mode === "turn" ? moveTurn(sample) : movePet(sample);
    },

    end(pointerId, now, cancelled = false) {
      return pointerId === active ? release(now, cancelled) : [];
    },

    reset(now) {
      return active === null ? [] : release(now, true);
    },
  };
}
