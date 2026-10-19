import type { StepProps } from "../stepTypes";
import { TypedExerciseStep } from "./TypedExerciseStep";

/** Step 3: type the word that belongs in the blank of an example sentence. */
export function FillBlankStep(props: StepProps) {
  return (
    <TypedExerciseStep
      {...props}
      kind="fill"
      inputLabel="Type the missing word"
      expectedAnswer={(word) => word.cloze?.answer ?? null}
      prompt={(word) => <p className="text-xl leading-relaxed">{word.cloze?.text}</p>}
      unavailableMessage="No sentence for this word yet."
      completeMessage="All the blanks are filled in."
    />
  );
}
