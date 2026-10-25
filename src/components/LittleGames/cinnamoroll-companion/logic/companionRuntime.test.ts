import { describe, expect, it, vi } from "vitest";
import { createCompanionRuntime } from "./companionRuntime";

describe("companionRuntime", () => {
  it("advances the pet state as events arrive", () => {
    const runtime = createCompanionRuntime(0);

    runtime.dispatch({ type: "touchStart", now: 10 });

    expect(runtime.pet.phase).toBe("headTouch");
  });

  it("tells the page about the first touch exactly once", () => {
    const onFirstTouch = vi.fn();
    const runtime = createCompanionRuntime(0, onFirstTouch);

    runtime.dispatch({ type: "tick", now: 5 });
    expect(onFirstTouch).not.toHaveBeenCalled();

    runtime.dispatch({ type: "touchStart", now: 10 });
    runtime.dispatch({ type: "touchEnd", now: 50 });
    runtime.dispatch({ type: "pat", now: 4_000 });

    expect(onFirstTouch).toHaveBeenCalledTimes(1);
  });

  // The page creates the runtime before it knows WebGL works, so pulling
  // three.js in here would download it on devices that cannot use it.
  it("loads without three.js", async () => {
    vi.resetModules();
    vi.doMock("three", () => {
      throw new Error("three.js belongs in the scene chunk");
    });
    try {
      const { createCompanionRuntime: create } = await import("./companionRuntime");
      expect(create(0).spin).toMatchObject({ yaw: 0, pitch: 0 });
    } finally {
      vi.doUnmock("three");
    }
  });
});
