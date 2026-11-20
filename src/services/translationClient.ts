import { translationPrompts, type TranslationAction } from "../../server/src/shared/translationPrompts";
import { API_BASE_URL } from "../constants/api";
import { generateGeminiContent } from "./geminiClient";
import { OpenAITranslationError } from "./translationErrors";
import { readTranslationModel } from "./translationPreferences";

export async function generateTranslationText(action: TranslationAction, text: string, signal?: AbortSignal): Promise<string> {
  const model = readTranslationModel();
  if (!model) {
    const result = await generateGeminiContent(translationPrompts[action](text), { action, signal });
    return result.response.text();
  }

  try {
    const { apiFetch } = await import("../utils/apiUtil");
    const response = await apiFetch(`${API_BASE_URL}/api/openai/translate`, {
      method: "POST",
      includeAuthToken: true,
      includeAppCheckToken: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, text, model }),
      signal,
    });
    const result = await response.json();
    if (!response.ok || typeof result.text !== "string" || !result.text.trim()) {
      throw new OpenAITranslationError(result.detail || "無法取得 OpenAI 譯文");
    }
    return result.text;
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof OpenAITranslationError) throw error;
    throw new OpenAITranslationError("無法連線至翻譯服務，請確認已登入並稍後再試");
  }
}
