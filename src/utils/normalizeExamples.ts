import type { Example } from "../types/vocabulary";

const firstText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

// AI output (including previously saved output) is not guaranteed to match
// the prompt's object schema. Normalize at both external data boundaries.
export function normalizeExamples(raw: unknown): Example[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): Example[] => {
    if (typeof entry === "string") {
      const sentence = entry.trim();
      return sentence ? [{ sentence }] : [];
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];

    const record = entry as Record<string, unknown>;
    const sentence = firstText(record.sentence, record.english, record.example, record.text);
    if (!sentence) return [];

    const translation = firstText(record.translation, record.chinese);
    return [{ sentence, ...(translation ? { translation } : {}) }];
  });
}
