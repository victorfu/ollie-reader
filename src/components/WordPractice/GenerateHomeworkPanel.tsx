import { useId, useState } from "react";
import type { CefrLevel, HomeworkOptions } from "../../types/wordPractice";
import { CEFR_LEVELS } from "../../utils/cefr";
import { ConfirmModal } from "../common/ConfirmModal";

const START_LEVEL_STORAGE_KEY = "ollie-word-practice-start-level";
const DEFAULT_WORD_COUNT = 10;
const DEFAULT_START_LEVEL: CefrLevel = "A1";
const WORD_COUNTS = Array.from({ length: 16 }, (_, i) => i + 5);

function readStartLevel(): CefrLevel {
  try {
    const stored = localStorage.getItem(START_LEVEL_STORAGE_KEY);
    return CEFR_LEVELS.find((level) => level === stored) ?? DEFAULT_START_LEVEL;
  } catch {
    return DEFAULT_START_LEVEL;
  }
}

function saveStartLevel(level: CefrLevel): void {
  try {
    localStorage.setItem(START_LEVEL_STORAGE_KEY, level);
  } catch {
    // The choice just is not remembered for next time.
  }
}

interface GenerateHomeworkPanelProps {
  /** Whether a homework is in progress, which generating would give up. */
  hasActive: boolean;
  generating: boolean;
  /** Starts generating; the page shows the outcome. */
  onGenerate: (options: HomeworkOptions) => Promise<void>;
}

export function GenerateHomeworkPanel({
  hasActive,
  generating,
  onGenerate,
}: GenerateHomeworkPanelProps) {
  const headingId = useId();
  const wordCountId = useId();
  const startLevelId = useId();
  const [wordCount, setWordCount] = useState(DEFAULT_WORD_COUNT);
  const [startLevel, setStartLevel] = useState<CefrLevel>(readStartLevel);
  const [confirming, setConfirming] = useState(false);

  const generate = () => void onGenerate({ wordCount, startLevel });

  const handleGenerateClick = () => {
    if (generating) return;
    if (hasActive) setConfirming(true);
    else generate();
  };

  const handleConfirm = () => {
    setConfirming(false);
    generate();
  };

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border border-border-hairline bg-card p-4 shadow-sm sm:p-6"
    >
      <h2 id={headingId} className="text-xl font-semibold">
        新功課
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={wordCountId} className="text-sm font-medium">
            單字數量
          </label>
          <select
            id={wordCountId}
            value={wordCount}
            onChange={(event) => setWordCount(Number(event.target.value))}
            className="select select-bordered min-h-11 w-full"
          >
            {WORD_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor={startLevelId} className="text-sm font-medium">
            起始等級
          </label>
          <select
            id={startLevelId}
            value={startLevel}
            onChange={(event) => {
              const level = CEFR_LEVELS.find((candidate) => candidate === event.target.value);
              if (!level) return;
              setStartLevel(level);
              saveStartLevel(level);
            }}
            className="select select-bordered min-h-11 w-full"
          >
            {CEFR_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        比起始等級更低、而且沒考錯過的字不會出現在功課裡；考錯過的字一定會排在最前面。
      </p>

      <button
        type="button"
        onClick={handleGenerateClick}
        disabled={generating}
        className="btn btn-primary min-h-11 w-full active:scale-[0.98] sm:w-auto"
      >
        {generating && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
        產生功課
      </button>

      {generating && (
        <p className="text-xs text-muted-foreground">
          Gemini 排隊時可能要等一分鐘以上，請先不要離開這一頁。
        </p>
      )}

      <ConfirmModal
        isOpen={confirming}
        title="產生新的功課"
        message="要放棄目前的功課嗎？"
        confirmText="放棄並產生"
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
