import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOCK_WIDTH_DEFAULT,
  DOCK_WIDTH_MAX,
  DOCK_WIDTH_MIN,
  VOCABULARY_DOCK_WIDTH_KEY,
  VOCABULARY_PANEL_MODE_KEY,
  clampDockWidth,
  readVocabularyDockWidth,
  readVocabularyPanelMode,
  writeVocabularyDockWidth,
  writeVocabularyPanelMode,
} from "./vocabularyPanelPreferences";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("clampDockWidth", () => {
  it("keeps an in-range width untouched", () => {
    expect(clampDockWidth(400)).toBe(400);
  });

  it("clamps to the allowed range", () => {
    expect(clampDockWidth(10)).toBe(DOCK_WIDTH_MIN);
    expect(clampDockWidth(9999)).toBe(DOCK_WIDTH_MAX);
  });

  it("falls back to the default for non-finite values", () => {
    expect(clampDockWidth(Number.NaN)).toBe(DOCK_WIDTH_DEFAULT);
    expect(clampDockWidth(Number.POSITIVE_INFINITY)).toBe(DOCK_WIDTH_DEFAULT);
  });
});

describe("readVocabularyPanelMode", () => {
  it("defaults to docked when nothing is stored", () => {
    expect(readVocabularyPanelMode()).toBe("docked");
  });

  it("reads back a stored mode", () => {
    localStorage.setItem(VOCABULARY_PANEL_MODE_KEY, "floating");
    expect(readVocabularyPanelMode()).toBe("floating");
  });

  it("falls back to docked for an unrecognised value", () => {
    localStorage.setItem(VOCABULARY_PANEL_MODE_KEY, "sideways");
    expect(readVocabularyPanelMode()).toBe("docked");
  });

  it("falls back to docked when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readVocabularyPanelMode()).toBe("docked");
  });
});

describe("writeVocabularyPanelMode", () => {
  it("persists the mode", () => {
    writeVocabularyPanelMode("floating");
    expect(localStorage.getItem(VOCABULARY_PANEL_MODE_KEY)).toBe("floating");
  });

  it("swallows storage failures", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => writeVocabularyPanelMode("docked")).not.toThrow();
  });
});

describe("dock width persistence", () => {
  it("defaults when nothing is stored", () => {
    expect(readVocabularyDockWidth()).toBe(DOCK_WIDTH_DEFAULT);
  });

  it("clamps a stored width that is out of range", () => {
    localStorage.setItem(VOCABULARY_DOCK_WIDTH_KEY, "9999");
    expect(readVocabularyDockWidth()).toBe(DOCK_WIDTH_MAX);
  });

  it("defaults when the stored width is not a number", () => {
    localStorage.setItem(VOCABULARY_DOCK_WIDTH_KEY, "wide");
    expect(readVocabularyDockWidth()).toBe(DOCK_WIDTH_DEFAULT);
  });

  it("round-trips a clamped width", () => {
    writeVocabularyDockWidth(1000);
    expect(readVocabularyDockWidth()).toBe(DOCK_WIDTH_MAX);
  });
});
