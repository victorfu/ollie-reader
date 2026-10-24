import { describe, expect, it } from "vitest";
import { createPointerTracker } from "./pointerTracker";

const HEAD_RADIUS_PX = 100;

function sample(
  pointerId: number,
  x: number,
  y: number,
  onHead: boolean,
  now = 0,
) {
  return { pointerId, x, y, onHead, now, headRadiusPx: HEAD_RADIUS_PX };
}

describe("pointerTracker", () => {
  it("ignores a press on the background", () => {
    const tracker = createPointerTracker();

    expect(tracker.down(sample(1, 10, 10, false))).toEqual({
      capture: false,
      events: [],
    });
    expect(tracker.move(sample(1, 60, 10, true, 16))).toEqual([]);
  });

  it("starts a touch and captures the pointer on a head press", () => {
    const tracker = createPointerTracker();

    expect(tracker.down(sample(1, 0, 0, true, 5))).toEqual({
      capture: true,
      events: [{ type: "touchStart", now: 5 }],
    });
  });

  it("reports movement on the head in head radii", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 200, 300, true));

    expect(tracker.move(sample(1, 230, 260, true, 16))).toEqual([
      { type: "stroke", now: 16, dx: 0.3, dy: -0.4 },
    ]);
  });

  it("ends the touch when the pointer slides off the head", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, true));

    expect(tracker.move(sample(1, 150, 0, false, 16))).toEqual([
      { type: "touchEnd", now: 16 },
    ]);
    // Still off the head: nothing more to report.
    expect(tracker.move(sample(1, 160, 0, false, 32))).toEqual([]);
  });

  it("starts a new touch without a jump stroke when sliding back on", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, true));
    tracker.move(sample(1, 150, 0, false, 16));

    expect(tracker.move(sample(1, 40, 0, true, 32))).toEqual([
      { type: "touchStart", now: 32 },
    ]);
    expect(tracker.move(sample(1, 50, 0, true, 48))).toEqual([
      { type: "stroke", now: 48, dx: 0.1, dy: 0 },
    ]);
  });

  it("follows only the first finger", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, true));

    expect(tracker.down(sample(2, 20, 20, true, 10))).toEqual({
      capture: false,
      events: [],
    });
    expect(tracker.move(sample(2, 80, 20, true, 16))).toEqual([]);
    expect(tracker.end(2, 20)).toEqual([]);

    // The first finger is still being followed.
    expect(tracker.move(sample(1, 10, 0, true, 32))).toEqual([
      { type: "stroke", now: 32, dx: 0.1, dy: 0 },
    ]);
  });

  it("ends the touch on release and frees the pointer for the next press", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, true));

    expect(tracker.end(1, 100)).toEqual([{ type: "touchEnd", now: 100 }]);
    expect(tracker.end(1, 110)).toEqual([]);
    expect(tracker.down(sample(7, 0, 0, true, 200)).events).toEqual([
      { type: "touchStart", now: 200 },
    ]);
  });

  it("frees the pointer on release even when it was off the head", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, true));
    tracker.move(sample(1, 150, 0, false, 16));

    expect(tracker.end(1, 50)).toEqual([]);
    expect(tracker.down(sample(2, 0, 0, true, 60)).capture).toBe(true);
  });

  it("drops whatever is held when the page loses the pointer", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, true));

    expect(tracker.reset(40)).toEqual([{ type: "touchEnd", now: 40 }]);
    expect(tracker.reset(50)).toEqual([]);
    expect(tracker.move(sample(1, 30, 0, true, 60))).toEqual([]);
  });

  it("ignores hover movement with no press", () => {
    const tracker = createPointerTracker();

    expect(tracker.move(sample(1, 30, 0, true, 16))).toEqual([]);
  });
});
