import { describe, expect, it } from "vitest";
import {
  getKeyboardSteeringDirection,
  getTouchDirection,
  isDashKey,
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
});
