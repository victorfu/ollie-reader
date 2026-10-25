import { useId, useState } from "react";
import type { PracticeSettings } from "../../types/wordPractice";
import { CEFR_LEVELS } from "../../utils/cefr";
import { ConfirmModal } from "../common/ConfirmModal";

interface ParentSettingsProps {
  settings: PracticeSettings;
  /** Whether a homework is in progress, which can be given up from here. */
  hasActive: boolean;
  /** Abandon waits while a homework is being made. */
  busy?: boolean;
  onSave: (next: PracticeSettings) => Promise<void>;
  onAbandon: () => Promise<void>;
  /** Starts the practice over: every word new again, no streak, no active homework. */
  onReset: () => Promise<void>;
}

const NEW_WORD_COUNTS = Array.from({ length: 8 }, (_, i) => i + 3);
const REVIEW_LIMITS = Array.from({ length: 21 }, (_, i) => i);

/** Collapsed at the bottom of the page: the amounts, the start level, giving up a homework and starting over. */
export function ParentSettings({
  settings,
  hasActive,
  busy = false,
  onSave,
  onAbandon,
  onReset,
}: ParentSettingsProps) {
  const newCountId = useId();
  const reviewId = useId();
  const levelId = useId();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const confirmAbandon = async () => {
    setAbandoning(true);
    try {
      await onAbandon();
    } finally {
      setAbandoning(false);
      setConfirming(false);
    }
  };

  const confirmReset = async () => {
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
      setConfirmingReset(false);
    }
  };

  return (
    <details className="rounded-xl border border-border-hairline bg-card shadow-sm">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        家長設定
      </summary>
      <div className="space-y-4 border-t border-border-hairline p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor={newCountId} className="text-sm font-medium">
              每份新字數
            </label>
            <select
              id={newCountId}
              value={draft.newWordCount}
              onChange={(event) => setDraft({ ...draft, newWordCount: Number(event.target.value) })}
              className="select select-bordered min-h-11 w-full"
            >
              {NEW_WORD_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={reviewId} className="text-sm font-medium">
              複習字上限
            </label>
            <select
              id={reviewId}
              value={draft.reviewLimit}
              onChange={(event) => setDraft({ ...draft, reviewLimit: Number(event.target.value) })}
              className="select select-bordered min-h-11 w-full"
            >
              {REVIEW_LIMITS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={levelId} className="text-sm font-medium">
              起始等級
            </label>
            <select
              id={levelId}
              value={draft.startLevel}
              onChange={(event) => {
                const level = CEFR_LEVELS.find((candidate) => candidate === event.target.value);
                if (level) setDraft({ ...draft, startLevel: level });
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
          比起始等級更低、而且沒寫錯過的字不會出現在新字裡；寫錯過的字一定會排在最前面。
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn btn-primary min-h-11 active:scale-[0.98]"
          >
            儲存設定
          </button>
          {hasActive && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="btn btn-ghost min-h-11 text-error active:scale-[0.98]"
            >
              放棄這份功課
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingReset(true)}
            className="btn btn-ghost min-h-11 text-error active:scale-[0.98]"
          >
            重設練習進度
          </button>
        </div>
      </div>

      {hasActive && (
        <ConfirmModal
          isOpen={confirming}
          title="放棄這份功課"
          message="放棄後不會計入歷史成績，進度也無法復原。確定要放棄嗎？"
          confirmText="放棄功課"
          isLoading={abandoning}
          onConfirm={() => void confirmAbandon()}
          onCancel={() => setConfirming(false)}
        />
      )}

      <ConfirmModal
        isOpen={confirmingReset}
        title="重設練習進度"
        message="所有單字會變回新字、複習排程和連續天數歸零，進行中的功課會被放棄。設定和歷史紀錄會保留。這個動作無法復原，確定要重設嗎？"
        confirmText="重設進度"
        isLoading={resetting}
        onConfirm={() => void confirmReset()}
        onCancel={() => setConfirmingReset(false)}
      />
    </details>
  );
}
