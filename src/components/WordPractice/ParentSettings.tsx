import { useId, useState } from "react";
import type { PracticeSettings } from "../../types/wordPractice";
import { CEFR_LEVELS } from "../../utils/cefr";
import { ConfirmModal } from "../common/ConfirmModal";
import { T } from "../common/T";

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

/** The word practice section of the settings page: the amounts, the start level, giving up a homework and starting over. */
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
    <div>
      <h3 className="text-lg font-semibold mb-3">
        <T k="practice.settings.title" variant="stacked" />
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        <T k="practice.settings.description" />
      </p>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor={newCountId} className="text-sm font-medium">
              <T k="practice.settings.newWordCount" />
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
              <T k="practice.settings.reviewLimit" />
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
              <T k="practice.settings.startLevel" />
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
          <T k="practice.settings.note" />
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn btn-primary min-h-11 active:scale-[0.98]"
          >
            <T k="practice.settings.save" variant="stacked" />
          </button>
          {hasActive && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="btn btn-ghost min-h-11 text-error active:scale-[0.98]"
            >
              <T k="practice.settings.abandon" variant="stacked" />
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingReset(true)}
            className="btn btn-ghost min-h-11 text-error active:scale-[0.98]"
          >
            <T k="practice.settings.reset" variant="stacked" />
          </button>
        </div>
      </div>

      {hasActive && (
        <ConfirmModal
          isOpen={confirming}
          title={<T k="practice.settings.abandon" variant="stacked" />}
          message={<T k="practice.settings.abandonMessage" />}
          confirmText={<T k="practice.settings.abandonConfirm" variant="stacked" />}
          isLoading={abandoning}
          onConfirm={() => void confirmAbandon()}
          onCancel={() => setConfirming(false)}
        />
      )}

      <ConfirmModal
        isOpen={confirmingReset}
        title={<T k="practice.settings.reset" variant="stacked" />}
        message={<T k="practice.settings.resetMessage" />}
        confirmText={<T k="practice.settings.resetConfirm" variant="stacked" />}
        isLoading={resetting}
        onConfirm={() => void confirmReset()}
        onCancel={() => setConfirmingReset(false)}
      />
    </div>
  );
}
