import { afterEach, describe, expect, it, vi } from "vitest";
import { getBestScore, setBestScore } from "./game-utils";

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
});
