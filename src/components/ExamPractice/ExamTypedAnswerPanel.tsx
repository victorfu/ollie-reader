import { useEffect, useRef, useState } from "react";
import { Send, Volume2 } from "lucide-react";
import type { ExamTextQuestion } from "../../types/exam";

interface ExamTypedAnswerPanelProps {
  question: ExamTextQuestion;
  isAnswered: boolean;
  /** TTS 是否可用;dictation 在不可用時退回直接顯示句子,避免題目被鎖死。 */
  speechSupported: boolean;
  onSubmit: (answer: string) => void;
  /** 已作答後在輸入框按 Enter 前往下一題。 */
  onNext: () => void;
  speak: (text: string) => void;
}

/**
 * 打字作答面板(qa/unscramble/dictation 共用)。
 * 由外層以 key={question.id} 掛載,換題時自動重置草稿。
 */
export function ExamTypedAnswerPanel({
  question,
  isAnswered,
  speechSupported,
  onSubmit,
  onNext,
  speak,
}: ExamTypedAnswerPanelProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const canUseAudio = speechSupported && Boolean(question.audioText);
  const showDictationFallback =
    question.form === "dictation" && !canUseAudio;
  const canSubmit = !isAnswered && draft.trim().length > 0;

  // 進題聚焦輸入框;作答後(按鈕送出時焦點在按鈕上)拉回輸入框,
  // 讓 Enter 能直接前往下一題。
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [question.id, isAnswered]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed || isAnswered) return;
    onSubmit(trimmed);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 題型提示區 */}
      {question.form === "qa" && question.hint && (
        <p className="text-sm text-muted-foreground">
          提示：
          <span className="ml-1 rounded-full bg-accent-tint px-2.5 py-1 font-semibold text-accent">
            {question.hint}
          </span>
        </p>
      )}

      {question.form === "unscramble" && question.hint && (
        <div className="flex flex-wrap items-center gap-2" aria-label="打散的單字">
          {question.hint.split("/").map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="rounded-lg border border-border-hairline bg-background/60 px-3 py-1.5 text-base font-medium shadow-soft"
            >
              {word.trim()}
            </span>
          ))}
        </div>
      )}

      {question.form === "dictation" &&
        (canUseAudio ? (
          <button
            type="button"
            onClick={() => question.audioText && speak(question.audioText)}
            className="btn btn-outline min-h-[48px] w-full gap-2 rounded-xl text-accent"
          >
            <Volume2 size={20} strokeWidth={2} />
            播放語音(可重複點)
          </button>
        ) : (
          <p className="rounded-lg border border-border-hairline bg-accent-tint p-3 text-sm">
            這裝置無法播放語音，請直接把這句打出來：
            <span className="ml-1 font-semibold">{question.acceptedAnswers[0]}</span>
          </p>
        ))}

      {/* 輸入列 */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // IME(注音等)選字中的 Enter 不觸發送出
            if (composingRef.current || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (isAnswered) {
              onNext();
            } else {
              submit();
            }
          }}
          disabled={isAnswered}
          placeholder="在這裡輸入英文句子…"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="輸入你的答案"
          className="input input-bordered min-h-[48px] flex-1 rounded-xl bg-background/50 text-base focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="btn btn-primary min-h-[48px] gap-1.5 rounded-xl px-5"
        >
          <Send size={16} strokeWidth={2} />
          送出
        </button>
      </div>

      {showDictationFallback ? null : question.form === "dictation" ? (
        <p className="text-xs text-muted-foreground">
          聽不清楚可以再按一次「播放語音」。
        </p>
      ) : null}
    </div>
  );
}
