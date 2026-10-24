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

export type PointerTracker = {
  down(sample: PointerSample): { capture: boolean; events: PetEvent[] };
  move(sample: PointerSample): PetEvent[];
  end(pointerId: number, now: number): PetEvent[];
  reset(now: number): PetEvent[];
};

/**
 * Turns raw pointer events into petting events. Follows one pointer at a
 * time: a second finger is ignored until the first one lifts, and a pressed
 * pointer that slides off the head stops counting until it slides back on.
 */
export function createPointerTracker(): PointerTracker {
  let active: number | null = null;
  let onHead = false;
  let lastX = 0;
  let lastY = 0;

  const release = (now: number): PetEvent[] => {
    const events: PetEvent[] = onHead ? [{ type: "touchEnd", now }] : [];
    active = null;
    onHead = false;
    return events;
  };

  return {
    down(sample) {
      if (active !== null || !sample.onHead) {
        return { capture: false, events: [] };
      }
      active = sample.pointerId;
      onHead = true;
      lastX = sample.x;
      lastY = sample.y;
      return { capture: true, events: [{ type: "touchStart", now: sample.now }] };
    },

    move(sample) {
      if (sample.pointerId !== active) return [];
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
    },

    end(pointerId, now) {
      return pointerId === active ? release(now) : [];
    },

    reset(now) {
      return active === null ? [] : release(now);
    },
  };
}
