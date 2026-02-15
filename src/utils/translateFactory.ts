import type { User } from "firebase/auth";
import { translateWithAI } from "../services/aiService";
import {
  findExistingTranslation,
  addSentenceTranslation,
} from "../services/sentenceTranslationService";
import { logger } from "./logger";

/**
 * Creates a translate function that checks the cache, calls AI, and saves the result.
 * Used by both PdfReader and ShowSubtitlesPage to avoid duplicating this logic.
 */
export function createTranslateFn(
  user: User | null,
  sourcePdfName?: string,
): (text: string, signal: AbortSignal) => Promise<string | null> {
  return async (text: string, signal: AbortSignal): Promise<string | null> => {
    if (user) {
      const cached = await findExistingTranslation(user.uid, text);
      if (cached) return cached.chinese;
    }
    if (signal.aborted) return null;

    const chinese = await translateWithAI(text, signal);
    if (!chinese || signal.aborted) return null;

    if (user) {
      try {
        await addSentenceTranslation({
          userId: user.uid,
          english: text,
          chinese,
          sourcePdfName,
        });
      } catch (e) {
        logger.error("Failed to cache translation:", e);
      }
    }
    return chinese;
  };
}
