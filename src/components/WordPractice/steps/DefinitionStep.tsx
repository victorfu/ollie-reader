import { redactWordForms } from "../../../utils/wordForms";
import type { StepProps } from "../stepTypes";
import { TypedExerciseStep } from "./TypedExerciseStep";

/** Step 4: read an English meaning and type the word it describes. */
export function DefinitionStep(props: StepProps) {
  return (
    <TypedExerciseStep
      {...props}
      kind="define"
      inputLabel="Type the word"
      expectedAnswer={(word) => word.word}
      prompt={(word) => (
        <ul className="space-y-2">
          {word.definitions.map((definition, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg">
              <span className="badge badge-outline badge-sm shrink-0">{definition.partOfSpeech}</span>
              <span>{redactWordForms(definition.definition, word.word, "____")}</span>
            </li>
          ))}
        </ul>
      )}
      completeMessage="You have named every word."
    />
  );
}
