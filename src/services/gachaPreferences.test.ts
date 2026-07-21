import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GACHA_MISS_RATE_PERCENT,
  GACHA_MISS_RATE_CHANGE_EVENT,
  GACHA_MISS_RATE_STORAGE_KEY,
  getGachaMissRatePercent,
  getShowAllGachaEntries,
  setGachaMissRatePercent,
  setShowAllGachaEntries,
  SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT,
  SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY,
} from "./gachaPreferences";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("gacha collection preferences", () => {
  it("defaults to hiding unowned entries", () => {
    expect(getShowAllGachaEntries()).toBe(false);
  });

  it("persists a bounded empty-capsule rate and announces the change", () => {
    const listener = vi.fn();
    window.addEventListener(GACHA_MISS_RATE_CHANGE_EVENT, listener);

    expect(getGachaMissRatePercent()).toBe(DEFAULT_GACHA_MISS_RATE_PERCENT);
    expect(setGachaMissRatePercent(75)).toBe(75);
    expect(window.localStorage.getItem(GACHA_MISS_RATE_STORAGE_KEY)).toBe(
      "75",
    );
    expect(getGachaMissRatePercent()).toBe(75);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(setGachaMissRatePercent(125)).toBe(100);
    expect(getGachaMissRatePercent()).toBe(100);

    window.removeEventListener(GACHA_MISS_RATE_CHANGE_EVENT, listener);
  });

  it("ignores malformed stored empty-capsule rates", () => {
    window.localStorage.setItem(GACHA_MISS_RATE_STORAGE_KEY, "not-a-rate");
    expect(getGachaMissRatePercent()).toBe(DEFAULT_GACHA_MISS_RATE_PERCENT);
  });

  it("persists both enabled and disabled values", () => {
    const listener = vi.fn();
    window.addEventListener(SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT, listener);

    setShowAllGachaEntries(true);
    expect(
      window.localStorage.getItem(SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY),
    ).toBe("true");
    expect(getShowAllGachaEntries()).toBe(true);

    setShowAllGachaEntries(false);
    expect(getShowAllGachaEntries()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener(SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT, listener);
  });

  it("falls back safely when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(getShowAllGachaEntries()).toBe(false);
    expect(() => setShowAllGachaEntries(true)).not.toThrow();
    expect(getGachaMissRatePercent()).toBe(DEFAULT_GACHA_MISS_RATE_PERCENT);
    expect(() => setGachaMissRatePercent(75)).not.toThrow();
  });
});
