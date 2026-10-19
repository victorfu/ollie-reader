import { useEffect, useRef, useState } from "react";
import { useSpeechState } from "../../../hooks/useSpeechState";
import { isAnswerCorrect } from "../../../utils/answerMatch";
import { SPELL_TARGET } from "../../../utils/homeworkProgress";
import { AnswerInput } from "../AnswerInput";
import { SpellingDiff } from "../SpellingDiff";
import type { StepProps } from "../stepTypes";
import { findIndexFrom, nextWordIndex } from "./stepHelpers";
import { PlayButton, StepComplete, StepFrame } from "./stepParts";

/**
 * Where a round is: looking at the word, typing it from memory, or looking at
 * the diff after a wrong spelling.
 */
type Phase = { kind: "show" } | { kind: "type" } | { kind: "missed"; typed: string };

/** Step 2: look, listen, cover, write, check. Each word has to be spelled right three times. */
export function SpellStep({ homework, onProgress, onExit }: StepProps) {
  const { speak } = useSpeechState();
  const { words, progress } = homework;
  const isPending = (i: number) => progress[i].spellCorrect < SPELL_TARGET;

  // -1 once every word is spelled: a returning learner finds the finish screen.
  const [index, setIndex] = useState(() => findIndexFrom(0, words.length, isPending));
  const [phase, setPhase] = useState<Phase>({ kind: "show" });
  const [typed, setTyped] = useState("");
  // What the last correct spelling earned, shown while the learner looks at the next round.
  const [praise, setPraise] = useState<string | null>(null);

  // Say each word once when it first comes up. Later rounds and "Look again" leave
  // it to the play button.
  const spokenIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (index === -1 || spokenIndexRef.current === index) return;
    spokenIndexRef.current = index;
    speak(words[index].word);
  }, [index, speak, words]);

  if (index === -1) {
    return (
      <StepFrame step="spell">
        <StepComplete message="You spelled every word correctly three times." onExit={onExit} />
      </StepFrame>
    );
  }

  const word = words[index];
  const spellCorrect = progress[index].spellCorrect;

  const check = () => {
    if (!isAnswerCorrect(typed, word.word)) {
      setPhase({ kind: "missed", typed: typed.trim() });
      return;
    }
    const nextCount = Math.min(SPELL_TARGET, spellCorrect + 1);
    const next = progress.map((entry, i) =>
      i === index ? { ...entry, spellCorrect: nextCount } : entry,
    );
    onProgress(next);
    const finishedWord = nextCount >= SPELL_TARGET;
    if (finishedWord) {
      setIndex(nextWordIndex(index, next.length, (i) => next[i].spellCorrect < SPELL_TARGET));
    }
    setPraise(finishedWord ? "Correct! On to the next word." : "Correct!");
    setTyped("");
    setPhase({ kind: "show" });
  };

  let status = "";
  if (phase.kind === "missed") status = "Not quite.";
  else if (phase.kind === "show" && praise) status = praise;

  return (
    <StepFrame
      step="spell"
      position={{ current: index + 1, total: words.length }}
      onExit={onExit}
    >
      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: SPELL_TARGET }, (_, i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full ${
                i < spellCorrect ? "bg-success" : "bg-foreground/20"
              }`}
            />
          ))}
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          {spellCorrect} of {SPELL_TARGET} correct
        </p>
      </div>

      {/* The live region stays mounted so that a change in its text is announced. */}
      <p role="status" className="min-h-6 text-center font-medium">
        {status}
      </p>

      {phase.kind === "show" && (
        <div className="space-y-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {word.emoji && (
              <span className="text-5xl leading-none" aria-hidden="true">
                {word.emoji}
              </span>
            )}
            <p className="break-words text-4xl font-semibold tracking-tight">{word.word}</p>
            <PlayButton label="Play pronunciation" onPlay={() => speak(word.word)} />
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setPraise(null);
              setPhase({ kind: "type" });
            }}
            className="btn btn-primary min-h-11 active:scale-[0.98]"
          >
            I’m ready
          </button>
        </div>
      )}

      {phase.kind === "type" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            {word.emoji && (
              <span className="text-5xl leading-none" aria-hidden="true">
                {word.emoji}
              </span>
            )}
            <PlayButton label="Play pronunciation" onPlay={() => speak(word.word)} />
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <AnswerInput
                value={typed}
                onChange={setTyped}
                onSubmit={check}
                label="Type the word from memory"
              />
            </div>
            <button
              type="button"
              disabled={typed.trim() === ""}
              onClick={check}
              className="btn btn-primary min-h-11 active:scale-[0.98]"
            >
              Check
            </button>
          </div>
        </div>
      )}

      {phase.kind === "missed" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            You typed <span className="font-medium text-foreground">{phase.typed}</span>
          </p>
          <div className="rounded-[10px] border border-border-hairline bg-background px-4 py-5">
            <SpellingDiff input={phase.typed} expected={word.word} />
          </div>
          <p>
            The word is <strong className="font-semibold">{word.word}</strong>. Look at the marked
            letters.
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setTyped("");
              setPhase({ kind: "show" });
            }}
            className="btn btn-primary min-h-11 active:scale-[0.98]"
          >
            Look again
          </button>
        </div>
      )}
    </StepFrame>
  );
}
