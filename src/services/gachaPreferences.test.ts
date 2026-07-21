import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getShowAllGachaEntries,
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
  });
});
