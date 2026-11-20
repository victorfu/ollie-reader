// A null model uses the existing Gemini path. A stored OpenAI model applies to this browser.
export const TRANSLATION_MODEL_KEY = "ollie.translation.openaiModel";

export function readTranslationModel(): string | null {
  try {
    return localStorage.getItem(TRANSLATION_MODEL_KEY) || null;
  } catch {
    return null;
  }
}

export function saveTranslationModel(model: string | null): void {
  if (model) localStorage.setItem(TRANSLATION_MODEL_KEY, model);
  else localStorage.removeItem(TRANSLATION_MODEL_KEY);
}
