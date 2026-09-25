import type { AnswerSpace } from "../../types/questionBank";

export type PrintScale = "small" | "normal" | "large";

export const PRINT_SCALES: readonly PrintScale[] = ["small", "normal", "large"];

export const PRINT_SCALE_FACTORS: Record<PrintScale, number> = {
  small: 0.85,
  normal: 1,
  large: 1.15,
};

export const PRINT_SCALE_LABELS: Record<PrintScale, string> = {
  small: "小",
  normal: "標準",
  large: "大",
};

/** 題目下方的作答留白（spec §12.2）。 */
export const ANSWER_SPACE_CM: Record<AnswerSpace, number> = {
  none: 0,
  small: 2,
  medium: 4,
  large: 7,
};

export interface PrintPreferences {
  enhance: boolean;
  scale: PrintScale;
  includeAnswers: boolean;
}

export const DEFAULT_PRINT_PREFERENCES: PrintPreferences = {
  enhance: false,
  scale: "normal",
  includeAnswers: true,
};

export const PRINT_PREFERENCES_KEY = "ollie-my-exams-print-preferences";

function isPrintScale(value: unknown): value is PrintScale {
  return typeof value === "string" && (PRINT_SCALES as readonly string[]).includes(value);
}

export function readPrintPreferences(): PrintPreferences {
  try {
    const raw = window.localStorage.getItem(PRINT_PREFERENCES_KEY);
    if (!raw) return DEFAULT_PRINT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_PRINT_PREFERENCES;
    const stored = parsed as Record<string, unknown>;
    return {
      enhance: typeof stored.enhance === "boolean" ? stored.enhance : DEFAULT_PRINT_PREFERENCES.enhance,
      scale: isPrintScale(stored.scale) ? stored.scale : DEFAULT_PRINT_PREFERENCES.scale,
      includeAnswers:
        typeof stored.includeAnswers === "boolean"
          ? stored.includeAnswers
          : DEFAULT_PRINT_PREFERENCES.includeAnswers,
    };
  } catch {
    return DEFAULT_PRINT_PREFERENCES;
  }
}

export function writePrintPreferences(preferences: PrintPreferences): void {
  try {
    window.localStorage.setItem(PRINT_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // 私密瀏覽或被封鎖時略過；設定只是方便用
  }
}
