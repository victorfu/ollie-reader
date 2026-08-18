import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MOTION_MODE,
  MOTION_SETTINGS_KEY,
  isMotionMode,
  readMotionMode,
  resolveMotion,
  writeMotionMode,
} from "./motionSettings";

afterEach(() => {
  window.localStorage.clear();
});

describe("resolveMotion", () => {
  it("follows the system preference by default", () => {
    expect(resolveMotion("auto", false)).toEqual({
      petMotionReduced: false,
      decorMotionReduced: false,
    });
    expect(resolveMotion("auto", true)).toEqual({
      petMotionReduced: true,
      decorMotionReduced: true,
    });
  });

  it("lets the player bring her movement back on a reduce-motion device", () => {
    // Without this, turning on the OS setting freezes her permanently and the
    // game reads as broken.
    expect(resolveMotion("on", true).petMotionReduced).toBe(false);
  });

  it("never revives decoration against the system preference", () => {
    // Asking to see her move is not the same as asking for confetti.
    expect(resolveMotion("on", true).decorMotionReduced).toBe(true);
  });

  it("stills everything when the player asks for it", () => {
    expect(resolveMotion("reduced", false)).toEqual({
      petMotionReduced: true,
      decorMotionReduced: true,
    });
  });
});

describe("motion mode storage", () => {
  it("accepts only known modes", () => {
    expect(isMotionMode("auto")).toBe(true);
    expect(isMotionMode("on")).toBe(true);
    expect(isMotionMode("reduced")).toBe(true);
    expect(isMotionMode("sideways")).toBe(false);
    expect(isMotionMode(null)).toBe(false);
  });

  it("round-trips through localStorage", () => {
    writeMotionMode("on");
    expect(window.localStorage.getItem(MOTION_SETTINGS_KEY)).toBe("on");
    expect(readMotionMode()).toBe("on");
  });

  it("falls back to the default for missing or corrupt values", () => {
    expect(readMotionMode()).toBe(DEFAULT_MOTION_MODE);
    window.localStorage.setItem(MOTION_SETTINGS_KEY, "wobble");
    expect(readMotionMode()).toBe(DEFAULT_MOTION_MODE);
  });
});
