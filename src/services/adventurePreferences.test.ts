import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADVENTURE_DEF_LANGUAGE_CHANGE_EVENT,
  ADVENTURE_DEF_LANGUAGE_STORAGE_KEY,
  DEFAULT_ADVENTURE_DEF_LANGUAGE,
  getAdventureDefLanguage,
  setAdventureDefLanguage,
} from "./adventurePreferences";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("adventure definition language preference", () => {
  it("defaults to Chinese", () => {
    expect(DEFAULT_ADVENTURE_DEF_LANGUAGE).toBe("zh");
    expect(getAdventureDefLanguage()).toBe("zh");
  });

  it("persists the choice and announces the change", () => {
    const listener = vi.fn();
    window.addEventListener(ADVENTURE_DEF_LANGUAGE_CHANGE_EVENT, listener);

    setAdventureDefLanguage("en");

    expect(
      window.localStorage.getItem(ADVENTURE_DEF_LANGUAGE_STORAGE_KEY),
    ).toBe("en");
    expect(getAdventureDefLanguage()).toBe("en");
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(ADVENTURE_DEF_LANGUAGE_CHANGE_EVENT, listener);
  });

  it("rejects unrecognised stored values", () => {
    for (const bogus of ["fr", "", "EN", "true", "zh-TW"]) {
      window.localStorage.setItem(ADVENTURE_DEF_LANGUAGE_STORAGE_KEY, bogus);
      expect(getAdventureDefLanguage()).toBe("zh");
    }
  });

  it("survives unavailable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(getAdventureDefLanguage()).toBe("zh");

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => setAdventureDefLanguage("en")).not.toThrow();
  });
});
