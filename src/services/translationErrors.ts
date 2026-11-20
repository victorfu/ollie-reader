import { isGeminiRateLimitError } from "./geminiErrorPolicy";

export class OpenAITranslationError extends Error {}

export function isTranslationServiceError(error: unknown): error is Error {
  return error instanceof OpenAITranslationError || isGeminiRateLimitError(error);
}
