import type { GenerateContentResult } from "firebase/ai";
import {
  GEMINI_MODEL_NAME,
  firebaseApp,
  geminiModel,
} from "../utils/firebaseUtil";
import { geminiRequestQueue } from "./geminiRequestQueue";
import { geminiCrossTabGate } from "./geminiCrossTabGate";
import { getGeminiMinimumStartIntervalMs } from "./geminiRuntimeConfig";

export type GeminiAction =
  | "word_details"
  | "translation"
  | "smart_lookup"
  | "sentence_parse"
  | "word_definition"
  | "speech_script"
  | "game_words";

export interface GenerateGeminiContentOptions {
  action: GeminiAction;
  signal?: AbortSignal;
}

const GEMINI_QUOTA_KEY = `${firebaseApp.options.projectId ?? "unknown-project"}:${GEMINI_MODEL_NAME}`;

/** The only application boundary allowed to invoke Firebase generateContent. */
export function generateGeminiContent(
  prompt: string,
  options: GenerateGeminiContentOptions,
): Promise<GenerateContentResult> {
  return geminiRequestQueue.run(
    (signal) =>
      geminiCrossTabGate.run(
        async (providerSignal) => {
          try {
            return await geminiModel.generateContent(prompt, {
              signal: providerSignal,
            });
          } catch (error) {
            // Persist breaker/cooldown state while the provider Web Lock is
            // still held, before another tab can begin its request.
            const observation = geminiRequestQueue.observeProviderError(
              error,
              GEMINI_QUOTA_KEY,
            );
            if (observation && !observation.crossTabStatePersisted) {
              geminiCrossTabGate.blockProviderUntil(observation.blockUntil);
            }
            throw error;
          }
        },
        {
          signal,
          minIntervalMs: getGeminiMinimumStartIntervalMs,
          beforeStart: (providerSignal) =>
            geminiRequestQueue.waitForSharedAvailability(
              GEMINI_QUOTA_KEY,
              providerSignal,
            ),
        },
      ),
    {
      action: options.action,
      quotaKey: GEMINI_QUOTA_KEY,
      signal: options.signal,
    },
  );
}
