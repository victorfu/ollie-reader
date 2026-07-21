export const SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY =
  "ollie-reader-show-all-gacha-entries";
export const SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT =
  "ollie-reader:show-all-gacha-entries-change";

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
