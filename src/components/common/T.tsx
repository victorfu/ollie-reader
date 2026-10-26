import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey, MessageParams } from "../../i18n/translate";
import { HintText } from "./HintText";

interface TProps {
  k: MessageKey;
  params?: MessageParams;
}

/** Translated text; in English mode, hovering it shows the Chinese meaning. */
export function T({ k, params }: TProps) {
  const { t, tZh, showHints } = useLanguage();
  const text = t(k, params);
  const hint = tZh(k, params);

  if (!showHints || hint === text) return <>{text}</>;

  return <HintText hint={hint}>{text}</HintText>;
}
