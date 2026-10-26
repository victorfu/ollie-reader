import { useLanguage } from "../../hooks/useLanguage";
import type { LanguageMode, MessageKey } from "../../i18n/translate";
import { T } from "./T";

const LANGUAGE_OPTIONS = [
  { id: "zh-TW", label: "settings.language.zh" },
  { id: "en", label: "settings.language.en" },
  { id: "en-hint", label: "settings.language.enHint" },
] as const satisfies readonly { id: LanguageMode; label: MessageKey }[];

interface LanguagePickerProps {
  /** "sm" for the sign-in screen footer, "md" for Settings. */
  size?: "sm" | "md";
}

/** Segmented control for the three language modes. */
export function LanguagePicker({ size = "md" }: LanguagePickerProps) {
  const { mode, setMode, t } = useLanguage();
  const sizeClass = size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-4 text-sm";

  return (
    <div
      role="group"
      aria-label={t("settings.language.title")}
      className="inline-flex flex-wrap justify-center gap-1 rounded-lg bg-base-200 p-1"
    >
      {LANGUAGE_OPTIONS.map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMode(opt.id)}
            aria-pressed={active}
            className={`inline-flex items-center rounded-md font-medium transition-colors active:scale-[0.98] ${sizeClass} ${
              active
                ? "bg-base-100 text-accent shadow-soft"
                : "text-muted-foreground hover:text-base-content"
            }`}
          >
            <T k={opt.label} variant="stacked" />
          </button>
        );
      })}
    </div>
  );
}
