import type { VocabularyPanelMode } from "../types/pdf";

export const VOCABULARY_PANEL_MODE_KEY = "ollie-reader-vocabulary-panel-mode";
export const VOCABULARY_DOCK_WIDTH_KEY = "ollie-reader-vocabulary-dock-width";

export const DOCK_WIDTH_MIN = 280;
export const DOCK_WIDTH_MAX = 560;
export const DOCK_WIDTH_DEFAULT = 360;

const DEFAULT_MODE: VocabularyPanelMode = "docked";

/** Keep a dock width inside the allowed range; non-finite input falls back. */
export function clampDockWidth(value: number): number {
  if (!Number.isFinite(value)) return DOCK_WIDTH_DEFAULT;
  return Math.min(Math.max(value, DOCK_WIDTH_MIN), DOCK_WIDTH_MAX);
}

export function readVocabularyPanelMode(): VocabularyPanelMode {
  try {
    const stored = localStorage.getItem(VOCABULARY_PANEL_MODE_KEY);
    if (stored === "floating" || stored === "docked") return stored;
  } catch {
    // localStorage not available
  }
  return DEFAULT_MODE;
}

export function writeVocabularyPanelMode(mode: VocabularyPanelMode): void {
  try {
    localStorage.setItem(VOCABULARY_PANEL_MODE_KEY, mode);
  } catch {
    // localStorage not available
  }
}

export function readVocabularyDockWidth(): number {
  try {
    const stored = localStorage.getItem(VOCABULARY_DOCK_WIDTH_KEY);
    if (stored !== null) {
      const parsed = Number.parseFloat(stored);
      if (Number.isFinite(parsed)) return clampDockWidth(parsed);
    }
  } catch {
    // localStorage not available
  }
  return DOCK_WIDTH_DEFAULT;
}

export function writeVocabularyDockWidth(width: number): void {
  try {
    localStorage.setItem(VOCABULARY_DOCK_WIDTH_KEY, String(clampDockWidth(width)));
  } catch {
    // localStorage not available
  }
}
