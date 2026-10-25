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
  return { pointerId, x, y, onHead, now, headRadiusPx: HEAD_RADIUS_PX, petting: true };
}

describe("pointerTracker", () => {
  it("turns the model when a drag starts off the head", () => {
    const tracker = createPointerTracker();

    expect(tracker.down(sample(1, 10, 10, false))).toEqual({
      capture: true,
      events: [],
    });
    // A wobble under the slop is still a tap, not a turn.
    expect(tracker.move(sample(1, 13, 11, false, 16))).toEqual([]);
    // Past the slop the whole distance since the press counts.
    expect(tracker.move(sample(1, 40, 12, false, 32))).toEqual([
      { type: "turn", now: 32, dx: 30, dy: 2 },
    ]);
    expect(tracker.move(sample(1, 50, 12, false, 48))).toEqual([
      { type: "turn", now: 48, dx: 10, dy: 0 },
    ]);
  });

  it("turns for an up-down drag too", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 10, 10, false));

    expect(tracker.move(sample(1, 11, 40, false, 16))).toEqual([
      { type: "turn", now: 16, dx: 1, dy: 30 },
    ]);
  });

  it("keeps turning, never petting, when a turn drag crosses the head", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, false));
    tracker.move(sample(1, 20, 0, false, 16));

    expect(tracker.move(sample(1, 40, 0, true, 32))).toEqual([
      { type: "turn", now: 32, dx: 20, dy: 0 },
    ]);
  });

  it("lets go of a turn on release so it can coast", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, false));
    tracker.move(sample(1, 30, 0, false, 16));

    expect(tracker.end(1, 40)).toEqual([{ type: "turnEnd", now: 40 }]);
    expect(tracker.end(1, 50)).toEqual([]);
  });

  it("does nothing when a press off the head is released without moving", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, false));

    expect(tracker.end(1, 40)).toEqual([]);
  });

  it("follows only the first finger while turning", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, false));

    expect(tracker.down(sample(2, 50, 0, true, 10)).capture).toBe(false);
    expect(tracker.move(sample(2, 80, 0, true, 16))).toEqual([]);
  });

  it("ends a turn when the page loses the pointer", () => {
    const tracker = createPointerTracker();
    tracker.down(sample(1, 0, 0, false));
    tracker.move(sample(1, 30, 0, false, 16));

    expect(tracker.reset(40)).toEqual([{ type: "turnEnd", now: 40 }]);
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


describe("head taps without a petting mode", () => {
  const head = (x = 0) => ({ ...sample(1, x, 0, true), petting: false });
  it("waits for release before patting and supports repeated taps", () => {
    const tracker = createPointerTracker();
    for (const now of [100, 200]) {
      expect(tracker.down(head()).events).toEqual([]);
      expect(tracker.end(1, now)).toEqual([{ type: "pat", now }]);
    }
  });
  it("rotates when dragging the head, even if the pointer returns to its start", () => {
    const tracker = createPointerTracker();
    tracker.down(head());
    expect(tracker.move(head(20))).toEqual([{ type: "turn", now: 0, dx: 20, dy: 0 }]);
    tracker.move(head());
    expect(tracker.end(1, 100)).toEqual([{ type: "turnEnd", now: 100 }]);
  });
  it("does not pat on cancellation or a second finger release", () => {
    const tracker = createPointerTracker();
    tracker.down(head());
    expect(tracker.end(2, 10)).toEqual([]);
    expect(tracker.end(1, 20, true)).toEqual([]);
    tracker.down(head());
    expect(tracker.reset(30)).toEqual([]);
  });
});
