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

/**
 * Match a recognised utterance against a target word or phrase without
 * accepting substrings inside a different word (for example, "the" must not
 * satisfy "he"). Extra words around the target are still allowed because
 * speech recognition commonly returns phrases such as "I said apple".
 */
export const matchesPronunciation = (
  spokenText: string,
  targetText: string,
): boolean => {
  const spoken = cleanText(spokenText).trim().replace(/\s+/g, " ");
  const target = cleanText(targetText).trim().replace(/\s+/g, " ");

  if (!spoken || !target) return false;
  if (spoken === target) return true;

  const spokenWords = spoken.split(" ");
  const targetWords = target.split(" ");
  if (targetWords.length > spokenWords.length) return false;

  return spokenWords.some((_, startIndex) =>
    targetWords.every(
      (targetWord, offset) => spokenWords[startIndex + offset] === targetWord,
    ),
  );
};
