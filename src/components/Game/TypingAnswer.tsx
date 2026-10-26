import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import { T } from "../common/T";

interface TypingAnswerProps {
  disabled: boolean; // 已作答後鎖定
  onSubmit: (attempt: string) => void;
}

/**
 * 鍵盤拼字作答：直接打出單字，Enter 或「完成」送出。
 * 關掉自動大寫／自動校正，免得手機鍵盤幫忙把字拼對（或改錯）。
 * 每題由父層 key 重新掛載即自動清空。
 */
export function TypingAnswer({ disabled, onSubmit }: TypingAnswerProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = !disabled && value.trim().length > 0;

  return (
    <form
      className="flex flex-col items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(value);
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        // 手機鍵盤彈出會擋住下半部，聚焦時把輸入框捲到畫面中間
        onFocus={() =>
          inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
        }
        disabled={disabled}
        autoFocus
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={t("adventure.typing.label")}
        placeholder={t("adventure.typing.placeholder")}
        className="input input-bordered w-full max-w-xs min-h-12 rounded-xl text-center text-2xl font-bold tracking-wide"
      />
      {!disabled && (
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary btn-sm gap-1 rounded-full min-h-11 px-6 disabled:opacity-40 active:scale-[0.98]"
        >
          <T k="adventure.spell.done" />
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}

export default TypingAnswer;
