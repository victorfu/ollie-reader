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

  // -1 once every question is done: a returning learner finds the finish screen.
  const [index, setIndex] = useState(() => findIndexFrom(0, words.length, isPending));
  const [value, setValue] = useState("");

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
    const answered = applyExerciseAnswer(exercise, isAnswerCorrect(value, expected));
    onProgress(
      progress.map((entry, i) => (i === index ? withExercise(entry, kind, answered) : entry)),
    );
    setValue("");
  };

  const next = () => {
    setIndex(nextWordIndex(index, words.length, isPending, (i) => !isDone(i)));
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
