import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MUSHROOM_CONFIG } from "../lib/constants";
import { flushStorageConvergence } from "../lib/game-utils";
import {
  loadMushroomProgress,
  mergeMushroomProgress,
  saveMushroomProgress,
  saveMushroomSettings,
} from "./persistence";

describe("mushroom persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges monotonic progress instead of overwriting a newer tab", () => {
    localStorage.setItem(
      MUSHROOM_CONFIG.PROGRESS_KEY,
      JSON.stringify({ version: 1, highestUnlocked: 5, tutorialDone: true }),
    );

    const saved = saveMushroomProgress({
      version: 1,
      highestUnlocked: 2,
      tutorialDone: false,
    });

    expect(saved).toEqual({
      version: 1,
      highestUnlocked: 5,
      tutorialDone: true,
    });
    expect(loadMushroomProgress()).toEqual(saved);
  });

  it("keeps the game usable when storage writes are blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() =>
      saveMushroomSettings(MUSHROOM_CONFIG.DEFAULT_SETTINGS),
    ).not.toThrow();
    expect(() =>
      saveMushroomProgress({
        version: 1,
        highestUnlocked: 1,
        tutorialDone: true,
      }),
    ).not.toThrow();
  });

  it("merges progress values monotonically", () => {
    expect(
      mergeMushroomProgress(
        { version: 1, highestUnlocked: 3, tutorialDone: false },
        { version: 1, highestUnlocked: 1, tutorialDone: true },
      ),
    ).toEqual({ version: 1, highestUnlocked: 3, tutorialDone: true });
  });

  it("converges after a simultaneous stale cross-tab write", async () => {
    saveMushroomProgress({
      version: 1,
      highestUnlocked: 6,
      tutorialDone: true,
    });

    // Another tab read the original progress and commits its lower snapshot.
    localStorage.setItem(
      MUSHROOM_CONFIG.PROGRESS_KEY,
      JSON.stringify({ version: 1, highestUnlocked: 2, tutorialDone: false }),
    );
    await flushStorageConvergence(MUSHROOM_CONFIG.PROGRESS_KEY);

    expect(loadMushroomProgress()).toEqual({
      version: 1,
      highestUnlocked: 6,
      tutorialDone: true,
    });
  });
});
