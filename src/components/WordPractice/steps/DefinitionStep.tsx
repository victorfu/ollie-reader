import { redactWordForms } from "../../../utils/wordForms";
import type { StepProps } from "../stepTypes";
import { DefinitionItem } from "./stepParts";
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
            <DefinitionItem key={i} partOfSpeech={definition.partOfSpeech}>
              {redactWordForms(definition.definition, word.word, "____")}
            </DefinitionItem>
          ))}
        </ul>
      )}
      completeMessage="You have named every word."
    />
  );
}
