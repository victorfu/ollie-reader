import { describe, expect, it } from "vitest";
import {
  createPetState,
  petExpression,
  reducePet,
  type PetEvent,
  type PetState,
} from "./petMachine";

function run(state: PetState, events: PetEvent[]): PetState {
  return events.reduce(reducePet, state);
}

/** Back-and-forth strokes every 16ms, alternating direction like a real pet. */
function strokes(from: number, to: number, step = 0.05): PetEvent[] {
  const events: PetEvent[] = [];
  for (let now = from, i = 0; now <= to; now += 16, i += 1) {
    events.push({ type: "stroke", now, dx: i % 20 < 10 ? step : -step, dy: 0 });
    events.push({ type: "tick", now });
  }
  return events;
}

describe("petMachine", () => {
  it("reacts the moment the head is touched", () => {
    const state = reducePet(createPetState(0), { type: "touchStart", now: 10 });

    expect(state.phase).toBe("headTouch");
  });

  it("holds a happy face briefly after a tap, then settles back to idle", () => {
    const released = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      { type: "touchEnd", now: 120 },
    ]);
    expect(released.phase).toBe("happyRelease");

    expect(reducePet(released, { type: "tick", now: 300 }).phase).toBe(
      "happyRelease",
    );
    expect(reducePet(released, { type: "tick", now: 3_000 }).phase).toBe(
      "idle",
    );
  });

  it("never escalates to petting or hearts while the finger rests still", () => {
    let state = reducePet(createPetState(0), { type: "touchStart", now: 0 });
    for (let now = 0; now <= 10_000; now += 100) {
      state = reducePet(state, { type: "tick", now });
    }

    expect(state.phase).toBe("headTouch");
    expect(state.hearts).toBe(0);
  });

  it("ignores small jitter but treats a real stroke as petting", () => {
    const touched = reducePet(createPetState(0), {
      type: "touchStart",
      now: 0,
    });

    const jitter = run(touched, [
      { type: "stroke", now: 16, dx: 0.02, dy: 0.01 },
      { type: "stroke", now: 32, dx: -0.02, dy: -0.01 },
    ]);
    expect(jitter.phase).toBe("headTouch");

    const stroked = run(touched, [
      { type: "stroke", now: 16, dx: 0.2, dy: 0 },
      { type: "stroke", now: 32, dx: 0.2, dy: 0.1 },
    ]);
    expect(stroked.phase).toBe("petting");
  });

  it("does not mistake a trembling finger for petting", () => {
    const trembling = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      ...strokes(16, 10_000, 0.004),
    ]);

    expect(trembling.phase).toBe("headTouch");
    expect(trembling.hearts).toBe(0);
  });

  it("lets petting fade when the finger only trembles afterwards", () => {
    const trembling = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      ...strokes(16, 500),
      ...strokes(516, 5_000, 0.004),
    ]);

    expect(trembling.phase).toBe("headTouch");
    expect(trembling.hearts).toBe(0);
  });

  it("rewards sustained petting with a few hearts, not one per stroke", () => {
    const start = reducePet(createPetState(0), { type: "touchStart", now: 0 });

    const oneSecond = run(start, strokes(16, 1_000));
    expect(oneSecond.phase).toBe("petting");
    expect(oneSecond.hearts).toBe(0);

    const twoSeconds = run(oneSecond, strokes(1_016, 2_000));
    expect(twoSeconds.hearts).toBe(1);

    const fiveSeconds = run(twoSeconds, strokes(2_016, 5_000));
    expect(fiveSeconds.hearts).toBeGreaterThanOrEqual(3);
    expect(fiveSeconds.hearts).toBeLessThanOrEqual(5);
  });

  it("does not count a pause in stroking toward hearts", () => {
    const petting = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      ...strokes(16, 800),
    ]);
    expect(petting.phase).toBe("petting");

    // Finger rests for a long time, then a single nudge.
    const paused = run(petting, [
      { type: "tick", now: 5_000 },
      { type: "stroke", now: 5_016, dx: 0.05, dy: 0 },
      { type: "tick", now: 5_016 },
    ]);
    expect(paused.hearts).toBe(0);
  });

  it("relaxes from petting back to a light touch when stroking stops", () => {
    const petting = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      ...strokes(16, 500),
    ]);

    expect(reducePet(petting, { type: "tick", now: 600 }).phase).toBe(
      "petting",
    );
    expect(reducePet(petting, { type: "tick", now: 2_500 }).phase).toBe(
      "headTouch",
    );
  });

  it("ignores strokes once the touch has ended", () => {
    const released = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      { type: "touchEnd", now: 50 },
      { type: "stroke", now: 66, dx: 0.5, dy: 0 },
      { type: "stroke", now: 82, dx: 0.5, dy: 0 },
    ]);

    expect(released.phase).toBe("happyRelease");
  });

  it("treats a duplicate end (pointerup after cancel) as a no-op", () => {
    const released = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      { type: "touchEnd", now: 50 },
    ]);

    expect(reducePet(released, { type: "touchEnd", now: 60 })).toEqual(
      released,
    );
  });

  it("resumes petting without restarting when the finger lifts between swipes", () => {
    const released = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      ...strokes(16, 1_000),
      { type: "touchEnd", now: 1_010 },
    ]);
    expect(released.phase).toBe("happyRelease");

    const resumed = reducePet(released, { type: "touchStart", now: 1_200 });
    expect(resumed.phase).toBe("petting");

    // The swipe-lift-swipe rhythm still adds up to a heart.
    const continued = run(resumed, strokes(1_216, 2_000));
    expect(continued.hearts).toBe(1);
  });

  it("starts fresh when touched again long after letting go", () => {
    const released = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      ...strokes(16, 1_000),
      { type: "touchEnd", now: 1_010 },
      { type: "tick", now: 6_000 },
    ]);
    expect(released.phase).toBe("idle");

    const touched = reducePet(released, { type: "touchStart", now: 6_100 });
    expect(touched.phase).toBe("headTouch");
  });

  it("plays a whole pet from one keyboard pat and lets go by itself", () => {
    const patted = reducePet(createPetState(0), { type: "pat", now: 0 });
    expect(patted.phase).toBe("petting");

    const later = run(patted, [{ type: "tick", now: 1_500 }]);
    expect(later.phase).toBe("happyRelease");

    expect(reducePet(later, { type: "tick", now: 6_000 }).phase).toBe("idle");
  });

  it("earns a heart from a few deliberate pats", () => {
    const patted = run(
      createPetState(0),
      [0, 400, 800, 1_200, 1_600].flatMap((now): PetEvent[] => [
        { type: "pat", now },
        { type: "tick", now },
      ]),
    );

    expect(patted.hearts).toBe(1);
  });

  it("ignores a keyboard pat while a finger is on the head", () => {
    const touching = reducePet(createPetState(0), {
      type: "touchStart",
      now: 0,
    });

    expect(reducePet(touching, { type: "pat", now: 10 })).toEqual(touching);
  });
});

describe("petExpression", () => {
  it("closes the eyes and smiles while being petted", () => {
    const petting = run(createPetState(0), [
      { type: "touchStart", now: 0 },
      ...strokes(16, 400),
    ]);

    const face = petExpression(petting, 400);
    expect(face.eyesClosed).toBe(1);
    expect(face.smile).toBeGreaterThan(0.5);
  });

  it("keeps the eyes open and the face calm at idle", () => {
    const face = petExpression(createPetState(0), 0);

    expect(face.eyesClosed).toBe(0);
    expect(face.smile).toBeLessThan(0.5);
    expect(face.delight).toBe(0);
  });

  it("builds delight the longer petting continues", () => {
    const start = run(createPetState(0), [{ type: "touchStart", now: 0 }]);
    const early = run(start, strokes(16, 300));
    const late = run(early, strokes(316, 1_500));

    expect(petExpression(late, 1_500).delight).toBeGreaterThan(
      petExpression(early, 300).delight,
    );
    expect(petExpression(late, 1_500).delight).toBeLessThanOrEqual(1);
  });

  it("lifts the head on a fresh touch", () => {
    const touched = reducePet(createPetState(0), {
      type: "touchStart",
      now: 0,
    });

    expect(petExpression(touched, 50).headLift).toBeGreaterThan(0);
    expect(petExpression(createPetState(0), 50).headLift).toBe(0);
  });
});
