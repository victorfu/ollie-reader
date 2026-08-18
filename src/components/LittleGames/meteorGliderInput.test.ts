import { describe, expect, it } from "vitest";
import {
  TUTORIAL_FINALE_SECONDS,
  getKeyboardSteeringDirection,
  getTouchDirection,
  isDashKey,
  isTutorialFinaleOver,
  shouldCountTutorialDash,
} from "./meteorGliderInput";

describe("Meteor Glider input", () => {
  it("normalizes shifted and Caps Lock A/D keys", () => {
    expect(getKeyboardSteeringDirection("a")).toBe(-1);
    expect(getKeyboardSteeringDirection("A")).toBe(-1);
    expect(getKeyboardSteeringDirection("d")).toBe(1);
    expect(getKeyboardSteeringDirection("D")).toBe(1);
    expect(getKeyboardSteeringDirection("ArrowLeft")).toBe(-1);
    expect(getKeyboardSteeringDirection("ArrowRight")).toBe(1);
  });

  it("keeps each steering pointer independent", () => {
    const pointers = new Map<number, -1 | 1>([
      [11, -1],
      [22, 1],
    ]);

    expect(getTouchDirection(pointers)).toBe(0);
    pointers.delete(22);
    expect(getTouchDirection(pointers)).toBe(-1);
  });

  it("recognizes dash keys without counting a dash before its tutorial step", () => {
    expect(isDashKey("Shift")).toBe(true);
    expect(isDashKey("K")).toBe(true);
    expect(shouldCountTutorialDash(0)).toBe(false);
    expect(shouldCountTutorialDash(2)).toBe(false);
    expect(shouldCountTutorialDash(3)).toBe(true);
  });

  it("keeps the tutorial running until the final dash has played out", () => {
    // 衝刺本身 0.24 秒，收尾時間要明顯更長才看得到效果
    expect(TUTORIAL_FINALE_SECONDS).toBeGreaterThan(1);
    expect(isTutorialFinaleOver(0)).toBe(false);
    expect(isTutorialFinaleOver(TUTORIAL_FINALE_SECONDS - 0.1)).toBe(false);
    expect(isTutorialFinaleOver(TUTORIAL_FINALE_SECONDS)).toBe(true);
  });
});
