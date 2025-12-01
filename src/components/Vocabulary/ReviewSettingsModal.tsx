import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReviewMode, ReviewSettings } from "../../types/vocabulary";

interface ReviewSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (settings: ReviewSettings) => void;
  totalWords: number;
  isLoading?: boolean;
}

const WORD_COUNT_OPTIONS = [
  { value: 5, label: "5 個", description: "快速複習 (~2分鐘)" },
  { value: 10, label: "10 個", description: "標準複習 (~5分鐘)" },
  { value: 20, label: "20 個", description: "深度複習 (~10分鐘)" },
  { value: 30, label: "30 個", description: "挑戰複習 (~15分鐘)" },
];

export function ReviewSettingsModal({
  isOpen,
  onClose,
  onStart,
  totalWords,
  isLoading = false,
}: ReviewSettingsModalProps) {
  const [wordCount, setWordCount] = useState(10);
  const [mode, setMode] = useState<ReviewMode>("smart");

  const handleStart = () => {
    onStart({ wordCount: Math.min(wordCount, totalWords), mode });
  };

  const actualWordCount = Math.min(wordCount, totalWords);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-base-100 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">複習設定</h2>
                <button
                  className="btn btn-ghost btn-sm btn-circle"
                  onClick={onClose}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-base-content/60">
                你有 {totalWords} 個單字可以複習
              </p>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 space-y-6">
              {/* Word Count Selection */}
              <div>
                <label className="text-sm font-medium mb-3 block">
                  複習數量
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WORD_COUNT_OPTIONS.map((option) => {
                    const isDisabled = option.value > totalWords;
                    const isSelected = wordCount === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setWordCount(option.value)}
                        className={`
                          p-3 rounded-xl border-2 text-left transition-all
                          ${isSelected
                            ? "border-primary bg-primary/10"
                            : "border-base-300 hover:border-primary/50"
                          }
                          ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}
                        `}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs text-base-content/60">
                          {option.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="text-sm font-medium mb-3 block">
                  選字模式
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setMode("smart")}
                    className={`
                      w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3
                      ${mode === "smart"
                        ? "border-primary bg-primary/10"
                        : "border-base-300 hover:border-primary/50"
                      }
                    `}
                  >
                    <span className="text-2xl">🧠</span>
                    <div>
                      <div className="font-semibold">智慧選字</div>
                      <div className="text-xs text-base-content/60">
                        優先選擇久未複習、容易忘記的單字
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("random")}
                    className={`
                      w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3
                      ${mode === "random"
                        ? "border-primary bg-primary/10"
                        : "border-base-300 hover:border-primary/50"
                      }
                    `}
                  >
                    <span className="text-2xl">🎲</span>
                    <div>
                      <div className="font-semibold">隨機選字</div>
                      <div className="text-xs text-base-content/60">
                        從所有單字中隨機抽選
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-0">
              <button
                className="btn btn-primary w-full gap-2"
                onClick={handleStart}
                disabled={isLoading || totalWords === 0}
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                開始複習 {actualWordCount} 個單字
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
