import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flushStorageConvergence,
  getBestScore,
  setBestScore,
} from "./game-utils";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("best score storage fallback", () => {
  it("returns a safe default when localStorage access is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });

    expect(getBestScore("blocked-score-read")).toBe(0);
  });

  it("keeps the session score when localStorage is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });

    setBestScore(420, "blocked-score-write");

    expect(getBestScore("blocked-score-write")).toBe(420);
  });

  it("does not replace a newer stored best with a stale lower score", () => {
    localStorage.setItem("cross-tab-score", "900");

    expect(setBestScore(450, "cross-tab-score")).toBe(900);
    expect(localStorage.getItem("cross-tab-score")).toBe("900");
  });

  it("converges after a simultaneous lower cross-tab write", async () => {
    const key = "simultaneous-cross-tab-score";
    setBestScore(900, key);

    // A second tab read the old value before our write and commits later.
    localStorage.setItem(key, "450");
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: "450" }),
    );
    await flushStorageConvergence(key);

    expect(localStorage.getItem(key)).toBe("900");
    expect(getBestScore(key)).toBe(900);
  });
});
