import { MUSHROOM_CONFIG } from "../lib/constants";
import {
  getLocalStorageItem,
  scheduleStorageConvergence,
  setLocalStorageItem,
} from "../lib/game-utils";
import type { MushroomSettings } from "../lib/types";
import { LEVEL_COUNT } from "./levels";
import type { MushroomProgress } from "./types";

export function loadMushroomSettings(): MushroomSettings {
  const stored = getLocalStorageItem(MUSHROOM_CONFIG.SETTINGS_KEY);
  if (stored) {
    try {
      return { ...MUSHROOM_CONFIG.DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      // Ignore malformed settings and keep the playable defaults.
    }
  }
  return { ...MUSHROOM_CONFIG.DEFAULT_SETTINGS };
}

export function saveMushroomSettings(settings: MushroomSettings): boolean {
  return setLocalStorageItem(
    MUSHROOM_CONFIG.SETTINGS_KEY,
    JSON.stringify(settings),
  );
}

function normalizeMushroomProgress(
  progress: Partial<MushroomProgress>,
): MushroomProgress {
  return {
    version: 1,
    highestUnlocked: Math.max(
      0,
      Math.min(
        LEVEL_COUNT - 1,
        Math.floor(progress.highestUnlocked ?? 0),
      ),
    ),
    tutorialDone: Boolean(progress.tutorialDone),
  };
}

export function mergeMushroomProgress(
  left: Partial<MushroomProgress>,
  right: Partial<MushroomProgress>,
): MushroomProgress {
  const normalizedLeft = normalizeMushroomProgress(left);
  const normalizedRight = normalizeMushroomProgress(right);
  return {
    version: 1,
    highestUnlocked: Math.max(
      normalizedLeft.highestUnlocked,
      normalizedRight.highestUnlocked,
    ),
    tutorialDone:
      normalizedLeft.tutorialDone || normalizedRight.tutorialDone,
  };
}

export function loadMushroomProgress(): MushroomProgress {
  const stored = getLocalStorageItem(MUSHROOM_CONFIG.PROGRESS_KEY);
  if (stored) {
    try {
      return normalizeMushroomProgress(
        JSON.parse(stored) as Partial<MushroomProgress>,
      );
    } catch {
      // Ignore malformed progress and start from a safe first-level state.
    }
  }
  return normalizeMushroomProgress({});
}

export function saveMushroomProgress(
  progress: MushroomProgress,
): MushroomProgress {
  const merged = mergeMushroomProgress(loadMushroomProgress(), progress);
  setLocalStorageItem(MUSHROOM_CONFIG.PROGRESS_KEY, JSON.stringify(merged));
  scheduleStorageConvergence(MUSHROOM_CONFIG.PROGRESS_KEY, () => {
    const converged = mergeMushroomProgress(
      loadMushroomProgress(),
      progress,
    );
    setLocalStorageItem(
      MUSHROOM_CONFIG.PROGRESS_KEY,
      JSON.stringify(converged),
    );
  });
  return merged;
}
