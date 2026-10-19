import { useState, type ReactNode } from "react";
import type {
  ExerciseProgress,
  HomeworkWord,
  HomeworkWordProgress,
} from "../../../types/wordPractice";
import { isAnswerCorrect } from "../../../utils/answerMatch";
import { applyExerciseAnswer } from "../../../utils/homeworkProgress";
import { AnswerInput } from "../AnswerInput";
import type { StepProps } from "../stepTypes";
import { findIndexFrom, nextWordIndex } from "./stepHelpers";
import { StepComplete, StepFrame } from "./stepParts";

type ExerciseKind = "fill" | "define";

interface TypedExerciseStepProps extends StepProps {
  kind: ExerciseKind;
  inputLabel: string;
  /** What the learner has to type, or null when this word has no question. */
  expectedAnswer: (word: HomeworkWord) => string | null;
  /** Other answers that count as correct, besides the one shown when the learner gives up. */
  alternativeAnswers?: (word: HomeworkWord) => readonly string[];
  /** The question itself. It must not give the answer away. */
  prompt: (word: HomeworkWord) => ReactNode;
  /** Shown instead of a question when `expectedAnswer` is null. */
  unavailableMessage?: string;
  completeMessage: string;
}

function withExercise(
  entry: HomeworkWordProgress,
  kind: ExerciseKind,
  exercise: ExerciseProgress,
): HomeworkWordProgress {
  return kind === "fill" ? { ...entry, fill: exercise } : { ...entry, define: exercise };
}

/**
 * The shared shape of the fill-in-the-blank and what's-the-word steps: one
 * typed question per word, two chances, then the answer is shown.
 */
export function TypedExerciseStep({
  kind,
  inputLabel,
  expectedAnswer,
  alternativeAnswers,
  prompt,
  unavailableMessage,
  completeMessage,
  homework,
  onProgress,
  onExit,
}: TypedExerciseStepProps) {
  const { words, progress } = homework;
  const isDone = (i: number) => progress[i][kind].done;
  // Words without a question are never done, but they are never waited for either.
  const isPending = (i: number) => expectedAnswer(words[i]) !== null && !isDone(i);

  const pendingNow = findIndexFrom(0, words.length, isPending);
  // Start at the first question still waiting for an answer. When only words
  // without a question are left (their sentences may still be on the way) start
  // on the first of them, so that the step is not "finished" before it began.
  // -1 means every word is done: a returning learner finds the finish screen.
  const [position, setPosition] = useState(() =>
    pendingNow !== -1 ? pendingNow : findIndexFrom(0, words.length, (i) => !isDone(i)),
  );
  const [value, setValue] = useState("");

  // The learner passed over the words without a question and reached the end, but
  // one of them has its sentence now: that question is still waiting.
  let index = position;
  if (position === -1 && pendingNow !== -1) {
    index = pendingNow;
    setPosition(pendingNow);
  }

  if (index === -1) {
    return (
      <StepFrame step={kind}>
        <StepComplete message={completeMessage} onExit={onExit} />
      </StepFrame>
    );
  }

  const word = words[index];
  const expected = expectedAnswer(word);
  const exercise = progress[index][kind];

  const check = () => {
    if (expected === null || exercise.done) return;
    const accepted = [expected, ...(alternativeAnswers?.(word) ?? [])];
    const answered = applyExerciseAnswer(
      exercise,
      accepted.some((answer) => isAnswerCorrect(value, answer)),
    );
    onProgress(
      progress.map((entry, i) => (i === index ? withExercise(entry, kind, answered) : entry)),
    );
    setValue("");
  };

  const next = () => {
    setPosition(nextWordIndex(index, words.length, isPending, (i) => !isDone(i)));
    setValue("");
  };

  const nextButton = (
    <button
      type="button"
      autoFocus
      onClick={next}
      className="btn btn-primary min-h-11 active:scale-[0.98]"
    >
      Next
    </button>
  );

  let status: ReactNode = "";
  let action: ReactNode;
  if (expected === null) {
    action = (
      <>
        <p className="text-muted-foreground">{unavailableMessage}</p>
        {nextButton}
      </>
    );
  } else if (exercise.done) {
    status = exercise.correct ? (
      "Correct!"
    ) : (
      <>
        The answer is <strong className="font-semibold">{expected}</strong>.
      </>
    );
    action = nextButton;
  } else {
    status = exercise.attempts > 0 ? "Not quite — try again." : "";
    action = (
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          {/* A new key after every try focuses the empty box again. */}
          <AnswerInput
            key={`${word.key}:${exercise.attempts}`}
            value={value}
            onChange={setValue}
            onSubmit={check}
            label={inputLabel}
          />
        </div>
        <button
          type="button"
          disabled={value.trim() === ""}
          onClick={check}
          className="btn btn-primary min-h-11 active:scale-[0.98]"
        >
          Check
        </button>
      </div>
    );
  }

  return (
    <StepFrame
      step={kind}
      position={{ current: index + 1, total: words.length }}
      onExit={onExit}
    >
      {expected !== null && prompt(word)}
      {/* The live region stays mounted so that a change in its text is announced. */}
      <p role="status" className="min-h-6 font-medium">
        {status}
      </p>
      <div className="space-y-4">{action}</div>
    </StepFrame>
  );
}
