/**
 * Text utility functions
 */

/**
 * Clean text for comparison - removes special characters and converts to lowercase
 * Useful for pronunciation matching and text comparison
 */
export const cleanText = (text: string): string => {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
};
