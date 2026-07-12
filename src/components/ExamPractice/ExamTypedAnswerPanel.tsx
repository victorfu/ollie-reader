import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, Send, Volume2 } from "lucide-react";
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
 * 元件跨題持續掛載(不以 key remount):iOS 螢幕鍵盤只在「使用者手勢中的
 * focus」開啟,要跨題保持鍵盤不收合,焦點必須一直留在同一個 DOM input 上,
 * 因此換題時只重置內部狀態,且 input 永不 disabled(已答後改為凍結輸入)。
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
  /** 已點過的字卡索引(以索引而非字面追蹤,重複單字才安全)。 */
  const [usedChips, setUsedChips] = useState<number[]>([]);
  const [lastQuestionId, setLastQuestionId] = useState(question.id);
  const inputRef = useRef<HTMLInputElement>(null);

  // 換題重置草稿與字卡(取代整個面板 remount)。在 render 期間依 prop
  // 調整 state 是 React 官方模式,不會像 effect 那樣多一輪 commit。
  if (lastQuestionId !== question.id) {
    setLastQuestionId(question.id);
    setDraft("");
    setUsedChips([]);
  }
  const composingRef = useRef(false);
  const canUseAudio = speechSupported && Boolean(question.audioText);
  const showDictationFallback =
    question.form === "dictation" && !canUseAudio;
  const canSubmit = !isAnswered && draft.trim().length > 0;
  const bankWords =
    question.form === "unscramble" && question.hint
      ? question.hint
          .split("/")
          .map((word) => word.trim())
          .filter(Boolean)
      : [];

  // qa/dictation 進題聚焦(同一 input 跨題保持,螢幕鍵盤不收合);
  // unscramble 主互動是點字卡,改收起鍵盤。
  useEffect(() => {
    if (question.form === "unscramble") {
      inputRef.current?.blur();
    } else {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [question.id, question.form]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed || isAnswered) return;
    // 觸控點「送出」會把焦點移到按鈕上;在同一手勢內拉回輸入框,
    // iOS 螢幕鍵盤才不會收合(unscramble 例外:鍵盤本來就不該打開)。
    if (question.form !== "unscramble") {
      inputRef.current?.focus({ preventScroll: true });
    }
    onSubmit(trimmed);
  };

  const appendWord = (word: string, index: number) => {
    if (isAnswered) return;
    setUsedChips((used) => [...used, index]);
    setDraft((current) => (current ? `${current} ${word}` : word));
  };

  const clearDraft = () => {
    setDraft("");
    setUsedChips([]);
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

      {question.form === "unscramble" && bankWords.length > 0 && (
        <div className="flex flex-col gap-2">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="打散的單字，點一下加入答案"
          >
            {bankWords.map((word, index) => {
              const used = usedChips.includes(index);
              return (
                <button
                  key={`${word}-${index}`}
                  type="button"
                  disabled={isAnswered || used}
                  aria-pressed={used}
                  aria-label={`加入單字 ${word}`}
                  onClick={() => appendWord(word, index)}
                  className={`inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-border-hairline px-3 text-base font-medium shadow-soft transition-all active:scale-[0.97] ${
                    used
                      ? "bg-base-200 opacity-40"
                      : "bg-background/60 hover:bg-accent/10"
                  }`}
                >
                  {used && (
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                  )}
                  {word}
                </button>
              );
            })}
            <button
              type="button"
              onClick={clearDraft}
              disabled={isAnswered || (draft === "" && usedChips.length === 0)}
              className="btn btn-ghost btn-sm min-h-[44px] gap-1 rounded-full text-muted-foreground"
            >
              <RotateCcw size={14} strokeWidth={2} />
              清除重來
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            點字卡把句子排出來，也可以直接輸入。
          </p>
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
          onChange={(event) => {
            // 已答後凍結輸入(不 disabled/readOnly,焦點留著鍵盤才不收)
            if (isAnswered) return;
            setDraft(event.target.value);
          }}
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
          aria-readonly={isAnswered}
          placeholder="在這裡輸入英文句子…"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint={isAnswered ? "next" : "send"}
          aria-label="輸入你的答案"
          className={`input input-bordered min-h-[48px] flex-1 rounded-xl bg-background/50 text-base focus-visible:ring-2 focus-visible:ring-accent ${
            isAnswered ? "opacity-70" : ""
          }`}
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
