import { describe, expect, it } from "vitest";
import { ACTION_MS, ACTIONS, actionPose } from "./actions";
import { createCompanionRuntime } from "./companionRuntime";
import { createPointerTracker, type PointerSample } from "./pointerTracker";
import { ACCESSORIES, COMPANION_PRICES, previewAccessory, shownOutfit, wearAccessory } from "./outfit";

const sample = (extra: Partial<PointerSample> = {}): PointerSample => ({ pointerId: 1, x: 0, y: 0, now: 0, onHead: false, headRadiusPx: 100, part: "belly", ...extra });

describe("companion actions", () => {
  it("interrupts petting, replaces rapid actions, finishes, and accepts a new pat", () => {
    const r = createCompanionRuntime(0);
    r.dispatch({ type: "touchStart", now: 1 });
    r.perform("jump", 2);
    expect(r.pet.contact).toBe(false);
    expect(r.pet.phase).toBe("idle");
    r.perform("wave", 3);
    expect(r.performance?.action).toBe("wave");
    r.dispatch({ type: "tick", now: ACTION_MS + 3 });
    expect(r.performance).toBeNull();
    r.perform("twirl", 2000);
    r.dispatch({ type: "pat", now: 2001 });
    expect(r.performance).toBeNull();
    expect(r.pet.phase).toBe("petting");
    r.setPetting(false);
    expect(r.pet.phase).toBe("idle");
  });

  it.each(ACTIONS)("returns $id to rest, including after a background tab gap", ({ id }) => {
    Object.values(actionPose({ action: id, since: 0 }, ACTION_MS + 10000, false)).forEach((value) => expect(value).toBeCloseTo(0));
    const reduced = actionPose({ action: id, since: 0 }, 800, true);
    expect(reduced.delight).toBe(1);
    Object.values({ ...reduced, delight: 0 }).forEach((value) => expect(value).toBeCloseTo(0));
  });

  it("distinguishes taps, drags, second fingers, and cancellation", () => {
    const t = createPointerTracker();
    t.down(sample());
    expect(t.end(2, 10)).toEqual([]);
    expect(t.end(1, 20)).toEqual([{ type: "perform", action: "belly", now: 20 }]);
    t.down(sample());
    expect(t.move(sample({ x: 20, now: 20 }))[0].type).toBe("turn");
    expect(t.end(1, 30)).toEqual([{ type: "turnEnd", now: 30 }]);
    t.down(sample({ part: "wave" }));
    expect(t.end(1, 40, true)).toEqual([]);
    t.down(sample());
    expect(t.reset(50)).toEqual([]);
  });

  it("strokes ears only in pet mode, throttles reactions, and cancels without an extra tap", () => {
    const t = createPointerTracker();
    t.down(sample({ part: "leftEar", petting: true }));
    expect(t.move(sample({ part: "leftEar", x: 12, now: 50 }))).toEqual([{ type: "perform", action: "leftEar", now: 50 }]);
    expect(t.move(sample({ part: "leftEar", x: 24, now: 100 }))).toEqual([]);
    expect(t.end(1, 110, true)).toEqual([]);
    t.down(sample({ part: "rightEar" }));
    expect(t.move(sample({ part: "rightEar", x: 20, now: 20 }))[0].type).toBe("turn");
  });

  it("does not interpret a drag off the ear as a completed tap", () => {
    const t = createPointerTracker();
    t.down(sample({ part: "leftEar", petting: true }));
    t.move(sample({ part: undefined, x: 200, now: 100 }));
    expect(t.end(1, 150)).toEqual([]);
  });
});

describe("preview outfits", () => {
  it("has six accessories and replaces only the matching slot without mutating the old outfit", () => {
    expect(ACCESSORIES).toHaveLength(6);
    const old = previewAccessory({ neck: "scarf" }, "bow");
    expect(previewAccessory(old, "crown")).toEqual({ neck: "scarf", head: "crown" });
    expect(old).toEqual({ neck: "scarf", head: "bow" });
    expect(previewAccessory(old, "bow")).toEqual({ neck: "scarf" });
  });
});

describe("wearing owned accessories versus trying others on", () => {
  const owned = new Set(["bow", "scarf"] as const);

  it("puts owned items on the saved equipment and keeps try-ons out of it", () => {
    let view = wearAccessory({ equipped: {}, trial: {} }, "bow", owned);
    expect(view).toEqual({ equipped: { head: "bow" }, trial: {} });
    view = wearAccessory(view, "crown", owned);
    expect(view).toEqual({ equipped: { head: "bow" }, trial: { head: "crown" } });
    expect(shownOutfit(view)).toEqual({ head: "crown" });
    // Taking the try-on off shows the saved bow again.
    expect(shownOutfit(wearAccessory(view, "crown", owned))).toEqual({ head: "bow" });
    // Choosing the owned bow over a try-on replaces the try-on.
    expect(wearAccessory(view, "bow", owned)).toEqual({ equipped: { head: "bow" }, trial: {} });
    expect(wearAccessory({ equipped: { head: "bow", neck: "scarf" }, trial: {} }, "scarf", owned))
      .toEqual({ equipped: { head: "bow" }, trial: {} });
  });

  it("prices every accessory with a positive whole number of tokens", () => {
    expect(ACCESSORIES.map((item) => [item.id, item.price])).toEqual(Object.entries(COMPANION_PRICES));
    expect(ACCESSORIES.every((item) => Number.isSafeInteger(item.price) && item.price > 0)).toBe(true);
  });
});
