import type { PageFitPreference } from "./pdfPageFit";

export const PDF_FIT_PREFERENCE_KEY = "ollie-reader-pdf-fit-mode";

/**
 * Kept per device rather than per account: whether a whole page is readable
 * depends on the screen, so a laptop and a large monitor may want different
 * choices.
 */
export function readPdfFitPreference(): PageFitPreference {
  try {
    const stored = localStorage.getItem(PDF_FIT_PREFERENCE_KEY);
    if (stored === "page" || stored === "width" || stored === "auto") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "auto";
}

export function writePdfFitPreference(preference: PageFitPreference): void {
  try {
    localStorage.setItem(PDF_FIT_PREFERENCE_KEY, preference);
  } catch {
    // localStorage not available
  }
}
