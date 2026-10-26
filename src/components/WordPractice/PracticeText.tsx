import { Fragment, type ReactNode } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey, MessageParams } from "../../i18n/translate";
import type { InflectionKind } from "../../utils/inflection";
import { HintText } from "../common/HintText";

interface PracticeTextProps {
  k: MessageKey;
  params?: MessageParams;
  /** Fills `{label}` with the name of this word form, in the same language as the sentence. */
  inflection?: InflectionKind;
  /** Names of params shown in bold (the word being learned). */
  bold?: string[];
}

const PLACEHOLDER = /\{(\w+)\}/;

/**
 * `<T>` for the Word Practice sentences that need more than plain params: the
 * `{label}` of a word form follows the language of the sentence (so the
 * Chinese hint never gets an English label), and the word itself can stay bold.
 */
export function PracticeText({
  k,
  params = {},
  inflection,
  bold = [],
}: PracticeTextProps) {
  const { t, tZh, showHints } = useLanguage();
  const withLabel = (translate: typeof t): MessageParams =>
    inflection ? { ...params, label: translate(`practice.inflection.${inflection}`) } : params;

  const shown = withLabel(t);
  const text = t(k, shown);
  const hint = tZh(k, withLabel(tZh));

  let content: ReactNode = text;
  if (bold.length > 0) {
    const plain = Object.fromEntries(Object.entries(shown).filter(([name]) => !bold.includes(name)));
    // Splitting on a capture group alternates text and placeholder names.
    content = t(k, plain)
      .split(PLACEHOLDER)
      .map((part, i) =>
        i % 2 === 1 && part in shown ? (
          <strong key={i} className="text-foreground">
            {String(shown[part])}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      );
  }

  if (!showHints || hint === text) return <>{content}</>;

  return <HintText hint={hint}>{content}</HintText>;
}
