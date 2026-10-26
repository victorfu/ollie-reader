import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw } from "lucide-react";
import { playSound } from "../../services/gameService";
import { useLanguage } from "../../hooks/useLanguage";
import { T } from "../common/T";

interface SpellChipsProps {
  letters: string[]; // 已打散的字母或單字塊（槽數 = 塊數）
  disabled: boolean; // 已作答後鎖定
  onSubmit: (attempt: string) => void;
  /** letter=拼字（字母直接相連）· word=句子排序（單字塊以空白相連，塊寬隨字長） */
  variant?: "letter" | "word";
}

/**
 * 拼字／句子排序作答 UI：點字塊填入答案槽、點答案槽的字塊可退回、集滿後按「完成」送出。
 * 用字塊的 index 追蹤（避免重複字母或單字混淆），每題由父層 key 重新掛載即自動重置。
 */
export function SpellChips({
  letters,
  disabled,
  onSubmit,
  variant = "letter",
}: SpellChipsProps) {
  const { t } = useLanguage();
  const [chosen, setChosen] = useState<number[]>([]);
  const chosenSet = new Set(chosen);
  const isWord = variant === "word";
  const attempt = chosen.map((i) => letters[i]).join(isWord ? " " : "");
  const isFull = chosen.length === letters.length;

  const pick = (i: number) => {
    if (disabled || chosenSet.has(i)) return;
    playSound("click");
    setChosen((prev) => [...prev, i]);
  };

  const removeAt = (pos: number) => {
    if (disabled) return;
    playSound("click");
    setChosen((prev) => prev.filter((_, k) => k !== pos));
  };

  const clearAll = () => {
    if (disabled) return;
    setChosen([]);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 答案槽 */}
      <div className="flex flex-wrap justify-center gap-2 min-h-14">
        {Array.from({ length: letters.length }).map((_, pos) => {
          const idx = chosen[pos];
          const filled = idx !== undefined;
          return (
            <button
              key={pos}
              onClick={() => filled && removeAt(pos)}
              disabled={!filled || disabled}
              className={`${
                isWord
                  ? "min-w-11 h-12 px-3 text-lg"
                  : "w-11 h-14 text-2xl"
              } rounded-xl border-2 flex items-center justify-center font-bold transition ${
                filled
                  ? "border-primary bg-primary/10 text-primary active:scale-95"
                  : "border-dashed border-base-300 bg-base-100/40 text-transparent"
              }`}
              aria-label={
                filled
                  ? t(isWord ? "adventure.order.remove" : "adventure.spell.remove", {
                      letter: letters[idx],
                    })
                  : t("adventure.spell.empty")
              }
            >
              {filled ? letters[idx] : "·"}
            </button>
          );
        })}
      </div>

      {/* 字母池 */}
      <div className="flex flex-wrap justify-center gap-2">
        <AnimatePresence>
          {letters.map((letter, i) =>
            chosenSet.has(i) ? null : (
              <motion.button
                key={i}
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => pick(i)}
                disabled={disabled}
                className={`${
                  isWord ? "min-w-12 px-3 text-lg" : "w-12 text-2xl"
                } h-12 rounded-xl bg-base-200 border border-base-300 font-bold text-base-content shadow-sm hover:bg-base-300`}
              >
                {letter}
              </motion.button>
            ),
          )}
        </AnimatePresence>
      </div>

      {/* 動作按鈕 */}
      {!disabled && (
        <div className="flex gap-3">
          <button
            onClick={clearAll}
            disabled={chosen.length === 0}
            className="btn btn-ghost btn-sm gap-1 rounded-full min-h-11 px-5 disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <T k="adventure.spell.clear" />
          </button>
          <button
            onClick={() => onSubmit(attempt)}
            disabled={!isFull}
            className="btn btn-primary btn-sm gap-1 rounded-full min-h-11 px-6 disabled:opacity-40 active:scale-[0.98]"
          >
            <T k="adventure.spell.done" />
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export default SpellChips;
