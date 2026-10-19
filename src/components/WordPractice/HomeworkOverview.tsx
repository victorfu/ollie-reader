import { useId, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { Homework } from "../../types/wordPractice";
import {
  STEP_ORDER,
  isStepComplete,
  isTestUnlocked,
  type StepId,
} from "../../utils/homeworkProgress";
import { ConfirmModal } from "../common/ConfirmModal";
import { STEP_LABELS } from "./stepTypes";

interface HomeworkOverviewProps {
  homework: Homework;
  /** While a replacement homework is being generated this one is read-only. */
  generating: boolean;
  onOpenStep: (step: StepId) => void;
  onAbandon: () => Promise<void>;
}

export function HomeworkOverview({
  homework,
  generating,
  onOpenStep,
  onAbandon,
}: HomeworkOverviewProps) {
  const headingId = useId();
  const [confirming, setConfirming] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  const completeCount = STEP_ORDER.filter((step) => isStepComplete(homework, step)).length;
  const testUnlocked = isTestUnlocked(homework);
  // The test comes last, so when no earlier step is left it is the one to continue with.
  const nextStep = STEP_ORDER.find((step) => !isStepComplete(homework, step)) ?? "test";

  const handleConfirmAbandon = async () => {
    setAbandoning(true);
    try {
      await onAbandon();
    } finally {
      setAbandoning(false);
      setConfirming(false);
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border border-border-hairline bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="text-xl font-semibold">
            進行中的功課
          </h2>
          <p className="text-sm text-muted-foreground">
            {homework.words.length} 個單字・已完成 {completeCount} / {STEP_ORDER.length} 個步驟
          </p>
        </div>
        <button
          type="button"
          disabled={generating}
          onClick={() => onOpenStep(nextStep)}
          className="btn btn-primary min-h-11 active:scale-[0.98]"
        >
          繼續
        </button>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2">
        {STEP_ORDER.map((step, index) => {
          const complete = isStepComplete(homework, step);
          const locked = step === "test" && !testUnlocked;
          const StatusIcon = complete ? CheckCircle2 : Circle;
          return (
            <li key={step}>
              <button
                type="button"
                disabled={locked || generating}
                onClick={() => onOpenStep(step)}
                className="flex min-h-11 w-full items-center gap-3 rounded-[10px] border border-border-hairline bg-background px-3 py-2 text-left shadow-sm transition-colors hover:bg-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background disabled:active:scale-100"
              >
                <span className="w-4 shrink-0 text-center text-sm tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{STEP_LABELS[step]}</span>
                  {locked && (
                    <span className="block text-xs text-muted-foreground">
                      完成步驟 1–5 後開放
                    </span>
                  )}
                </span>
                <span
                  className={`flex shrink-0 items-center gap-1 text-sm ${
                    complete ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  <StatusIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  {complete ? "已完成" : "未完成"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        disabled={generating}
        onClick={() => setConfirming(true)}
        className="btn btn-ghost min-h-11 text-error active:scale-[0.98]"
      >
        放棄這份功課
      </button>

      <ConfirmModal
        isOpen={confirming}
        title="放棄這份功課"
        message="放棄後不會計入歷史成績，進度也無法復原。確定要放棄嗎？"
        confirmText="放棄功課"
        isLoading={abandoning}
        onConfirm={() => void handleConfirmAbandon()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
