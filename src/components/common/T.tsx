import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey, MessageParams } from "../../i18n/translate";
import { HintText } from "./HintText";

interface TProps {
  k: MessageKey;
  params?: MessageParams;
  /**
   * How the Chinese is offered in "English + Chinese hints" mode:
   * - "inline": dotted underline, tap or hover for a tooltip (body text, labels).
   * - "stacked": small Chinese line under the English, always visible
   *   (navigation, headings, and anything inside a button or link).
   */
  variant?: "inline" | "stacked";
}

/** Translated text that also renders the Chinese hint when the mode asks for it. */
export function T({ k, params, variant = "inline" }: TProps) {
  const { t, tZh, showHints } = useLanguage();
  const text = t(k, params);
  const hint = tZh(k, params);

  if (!showHints || hint === text) return <>{text}</>;

  if (variant === "stacked") {
    return (
      <span className="inline-flex min-w-0 flex-col leading-tight">
        <span className="truncate">{text}</span>
        <span
          lang="zh-Hant-TW"
          className="truncate text-[0.72em] font-normal opacity-70"
        >
          {hint}
        </span>
      </span>
    );
  }

  return <HintText hint={hint}>{text}</HintText>;
}
