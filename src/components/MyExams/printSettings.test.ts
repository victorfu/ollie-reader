import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANSWER_SPACE_CM,
  DEFAULT_PRINT_PREFERENCES,
  PRINT_PREFERENCES_KEY,
  PRINT_SCALE_FACTORS,
  readPrintPreferences,
  writePrintPreferences,
} from "./printSettings";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("print constants", () => {
  it("match the spec", () => {
    expect(PRINT_SCALE_FACTORS).toEqual({ small: 0.85, normal: 1, large: 1.15 });
    expect(ANSWER_SPACE_CM).toEqual({ none: 0, small: 2, medium: 4, large: 7 });
    expect(DEFAULT_PRINT_PREFERENCES).toEqual({ enhance: false, scale: "normal", includeAnswers: true });
  });
});

describe("readPrintPreferences", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(readPrintPreferences()).toEqual(DEFAULT_PRINT_PREFERENCES);
  });

  it("round-trips stored preferences", () => {
    writePrintPreferences({ enhance: true, scale: "large", includeAnswers: false });
    expect(readPrintPreferences()).toEqual({ enhance: true, scale: "large", includeAnswers: false });
  });

  it("falls back per field for invalid values", () => {
    window.localStorage.setItem(PRINT_PREFERENCES_KEY, JSON.stringify({ enhance: "yes", scale: "huge", includeAnswers: false }));
    expect(readPrintPreferences()).toEqual({ enhance: false, scale: "normal", includeAnswers: false });
  });

  it("survives broken JSON and blocked storage", () => {
    window.localStorage.setItem(PRINT_PREFERENCES_KEY, "{not json");
    expect(readPrintPreferences()).toEqual(DEFAULT_PRINT_PREFERENCES);

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readPrintPreferences()).toEqual(DEFAULT_PRINT_PREFERENCES);
  });
});

describe("writePrintPreferences", () => {
  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writePrintPreferences(DEFAULT_PRINT_PREFERENCES)).not.toThrow();
  });
});
