import { useId, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Volume2 } from "lucide-react";
import type { StepId } from "../../../utils/homeworkProgress";
import { STEP_LABELS } from "../stepTypes";

interface StepFrameProps {
  step: StepId;
  /** Which word is on screen. Left out on the finish screen. */
  position?: { current: number; total: number };
  /** Gives the learner a way out mid-step. The finish screen has its own button instead. */
  onExit?: () => void;
  children: ReactNode;
}

/** The card every practice step sits in, with its title and "Word N of M". */
export function StepFrame({ step, position, onExit, children }: StepFrameProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="btn btn-ghost min-h-11 gap-1.5 active:scale-[0.98]"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Back to overview
        </button>
      )}
      <div className="space-y-5 rounded-xl border border-border-hairline bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id={headingId} className="text-xl font-semibold">
            {STEP_LABELS[step]}
          </h2>
          {position && (
            <p className="text-sm tabular-nums text-muted-foreground">
              Word {position.current} of {position.total}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

interface StepCompleteProps {
  message: string;
  onExit: () => void;
  /** An optional second button, for steps the learner may want to look at again. */
  secondary?: { label: string; onClick: () => void };
}

/** Shown once every word of a step is done. */
export function StepComplete({ message, onExit, secondary }: StepCompleteProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <CheckCircle2 className="size-10 text-success" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-lg font-semibold">Well done!</p>
      <p className="text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onExit}
        autoFocus
        className="btn btn-primary mt-2 min-h-11 active:scale-[0.98]"
      >
        Back to overview
      </button>
      {secondary && (
        <button
          type="button"
          onClick={secondary.onClick}
          className="btn btn-outline min-h-11 active:scale-[0.98]"
        >
          {secondary.label}
        </button>
      )}
    </div>
  );
}

/** One meaning of a word. Stored data may lack the part of speech, in which case no badge is drawn. */
export function DefinitionItem({
  partOfSpeech,
  children,
}: {
  partOfSpeech: string | undefined;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg">
      {typeof partOfSpeech === "string" && partOfSpeech.trim() !== "" && (
        <span className="badge badge-outline badge-sm shrink-0">{partOfSpeech}</span>
      )}
      <span>{children}</span>
    </li>
  );
}

/** A round speaker button. */
export function PlayButton({ label, onPlay }: { label: string; onPlay: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPlay}
      className="btn btn-circle btn-ghost min-h-11 min-w-11 text-accent active:scale-[0.98]"
    >
      <Volume2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
