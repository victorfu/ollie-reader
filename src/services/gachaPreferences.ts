export const SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY =
  "ollie-reader-show-all-gacha-entries";
export const SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT =
  "ollie-reader:show-all-gacha-entries-change";
export const GACHA_MISS_RATE_STORAGE_KEY =
  "ollie-gacha-machine-miss-rate-v1";
export const GACHA_MISS_RATE_CHANGE_EVENT =
  "ollie-reader:gacha-miss-rate-change";
export const DEFAULT_GACHA_MISS_RATE_PERCENT = 50;

function normalizeGachaMissRatePercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GACHA_MISS_RATE_PERCENT;
  return Math.min(100, Math.max(0, value));
}

export function getShowAllGachaEntries(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setShowAllGachaEntries(showAll: boolean): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY,
      String(showAll),
    );
    window.dispatchEvent(new Event(SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT));
  } catch {
    // Keep the preference in component state when storage is unavailable.
  }
}

export function getGachaMissRatePercent(): number {
  if (typeof window === "undefined") return DEFAULT_GACHA_MISS_RATE_PERCENT;

  try {
    const stored = window.localStorage.getItem(GACHA_MISS_RATE_STORAGE_KEY);
    if (stored === null) return DEFAULT_GACHA_MISS_RATE_PERCENT;

    const parsed = Number(stored);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }

  return DEFAULT_GACHA_MISS_RATE_PERCENT;
}

export function setGachaMissRatePercent(value: number): number {
  const normalized = normalizeGachaMissRatePercent(value);
  if (typeof window === "undefined") return normalized;

  try {
    window.localStorage.setItem(
      GACHA_MISS_RATE_STORAGE_KEY,
      String(normalized),
    );
  } catch {
    // The setting still applies for this session when storage is unavailable.
  }

  window.dispatchEvent(
    new CustomEvent<number>(GACHA_MISS_RATE_CHANGE_EVENT, {
      detail: normalized,
    }),
  );
  return normalized;
}
