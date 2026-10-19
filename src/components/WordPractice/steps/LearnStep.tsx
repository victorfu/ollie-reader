import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useSpeechState } from "../../../hooks/useSpeechState";
import type { StepProps } from "../stepTypes";
import { findIndexFrom } from "./stepHelpers";
import { DefinitionItem, PlayButton, StepComplete, StepFrame } from "./stepParts";

/** Step 1: one card per word. A card counts as learned as soon as it is shown. */
export function LearnStep({ homework, onProgress, onExit }: StepProps) {
  const { speak } = useSpeechState();
  const { words, progress } = homework;
  // -1 once every card has been seen: a returning learner finds the finish screen.
  const [index, setIndex] = useState(() => findIndexFrom(0, words.length, (i) => !progress[i].learned));

  useEffect(() => {
    if (index === -1 || progress[index].learned) return;
    onProgress(progress.map((entry, i) => (i === index ? { ...entry, learned: true } : entry)));
  }, [index, progress, onProgress]);

  if (index === -1) {
    return (
      <StepFrame step="learn">
        <StepComplete
          message="You have looked at every word."
          onExit={onExit}
          secondary={
            words.length > 0 ? { label: "Review the cards", onClick: () => setIndex(0) } : undefined
          }
        />
      </StepFrame>
    );
  }

  const word = words[index];
  const sentence = word.sentence;
  const isLast = index === words.length - 1;

  return (
    <StepFrame
      step="learn"
      position={{ current: index + 1, total: words.length }}
      onExit={onExit}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {word.emoji && (
            <span className="text-5xl leading-none" aria-hidden="true">
              {word.emoji}
            </span>
          )}
          <h3 className="break-words text-4xl font-semibold tracking-tight">{word.word}</h3>
          <PlayButton label="Play pronunciation" onPlay={() => speak(word.word)} />
        </div>

        <ul className="space-y-2">
          {word.definitions.map((definition, i) => (
            <DefinitionItem key={i} partOfSpeech={definition.partOfSpeech}>
              {definition.definition}
            </DefinitionItem>
          ))}
        </ul>

        {sentence && (
          <div className="flex items-start justify-between gap-2 rounded-[10px] border border-border-hairline bg-accent-tint py-1 pl-4 pr-1">
            <p className="py-2.5 text-lg italic">{sentence}</p>
            <PlayButton label="Play sentence" onPlay={() => speak(sentence)} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          className="btn btn-outline min-h-11 gap-1.5 active:scale-[0.98]"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => setIndex(isLast ? -1 : index + 1)}
          className="btn btn-primary min-h-11 gap-1.5 active:scale-[0.98]"
        >
          Next
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </StepFrame>
  );
}
