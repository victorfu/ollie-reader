import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "../../services/gameService";

interface SpellChipsProps {
  letters: string[]; // 已打散的字母（槽數 = 字母數）
  disabled: boolean; // 已作答後鎖定
  onSubmit: (attempt: string) => void;
}

/**
 * 拼字題作答 UI：點字母填入答案槽、點答案槽的字母可退回、集滿後按「完成」送出。
 * 用字母的 index 追蹤（避免重複字母混淆），每題由父層 key 重新掛載即自動重置。
 */
export function SpellChips({ letters, disabled, onSubmit }: SpellChipsProps) {
  const [chosen, setChosen] = useState<number[]>([]);
  const chosenSet = new Set(chosen);
  const attempt = chosen.map((i) => letters[i]).join("");
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
              className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition ${
                filled
                  ? "border-primary bg-primary/10 text-primary active:scale-95"
                  : "border-dashed border-base-300 bg-base-100/40 text-transparent"
              }`}
              aria-label={filled ? `移除字母 ${letters[idx]}` : "空格"}
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
                className="w-12 h-12 rounded-xl bg-base-200 border border-base-300 text-2xl font-bold text-base-content shadow-sm hover:bg-base-300"
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
            className="btn btn-ghost btn-sm rounded-full min-h-11 px-5 disabled:opacity-40"
          >
            ↺ 清除
          </button>
          <button
            onClick={() => onSubmit(attempt)}
            disabled={!isFull}
            className="btn btn-primary btn-sm rounded-full min-h-11 px-6 disabled:opacity-40 active:scale-[0.98]"
          >
            完成 ✓
          </button>
        </div>
      )}
    </div>
  );
}

export default SpellChips;
