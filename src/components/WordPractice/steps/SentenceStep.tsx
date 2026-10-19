import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getSentenceFeedback } from "../../../services/wordPracticeAi";
import { logger } from "../../../utils/logger";
import { sentenceUsesWord } from "../../../utils/wordForms";
import type { StepProps } from "../stepTypes";
import { findIndexFrom } from "./stepHelpers";
import { DefinitionItem, StepComplete, StepFrame } from "./stepParts";

/**
 * Step 5: write one sentence with each word. A sentence counts as soon as it
 * uses the word; the feedback from Gemini is a bonus, so a failed request does
 * not hold the learner back.
 */
export function SentenceStep({ homework, onProgress, onExit }: StepProps) {
  const inputId = useId();
  const { words, progress } = homework;
  const hasSentence = (i: number) => {
    const sentence = progress[i].sentence;
    return sentence !== null && sentenceUsesWord(sentence.text, words[i].word);
  };

  // -1 once every word has a sentence: a returning learner finds the finish screen.
  const [index, setIndex] = useState(() => findIndexFrom(0, words.length, (i) => !hasSentence(i)));
  const [draft, setDraft] = useState(() => (index === -1 ? "" : (progress[index].sentence?.text ?? "")));
  // The word is missing from the last sentence the learner tried to send.
  const [missingWord, setMissingWord] = useState(false);
  // Feedback is being fetched for the sentence of the word on screen.
  const [checking, setChecking] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  // The answer arrives long after the click. By then the learner may have changed
  // other words' progress, which must not be written over.
  const latestRef = useRef({ homework, onProgress });
  useEffect(() => {
    latestRef.current = { homework, onProgress };
  });
  useEffect(() => () => controllerRef.current?.abort(), []);

  const cancelRequest = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setChecking(false);
  };

  const goTo = (next: number) => {
    cancelRequest();
    setMissingWord(false);
    setIndex(next);
    setDraft(next === -1 ? "" : (progress[next].sentence?.text ?? ""));
  };

  const requestFeedback = async (wordIndex: number, sentence: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { key, word } = words[wordIndex];
    setChecking(true);
    try {
      const feedback = await getSentenceFeedback(word, sentence, controller.signal);
      // A request that was cancelled (the learner moved on or sent a new sentence) is silent.
      if (controller.signal.aborted) return;
      const { homework: latest, onProgress: report } = latestRef.current;
      const target = latest.words.findIndex((candidate) => candidate.key === key);
      if (target !== -1) {
        report(
          latest.progress.map((entry, i) =>
            i === target ? { ...entry, sentence: { text: sentence, feedback } } : entry,
          ),
        );
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      logger.error("Could not get feedback on the sentence:", error);
    }
    setChecking(false);
  };

  if (index === -1) {
    return (
      <StepFrame step="sentence">
        <StepComplete
          message="You wrote a sentence for every word."
          onExit={onExit}
          secondary={
            words.length > 0
              ? { label: "Review my sentences", onClick: () => goTo(0) }
              : undefined
          }
        />
      </StepFrame>
    );
  }

  const word = words[index];
  const saved = hasSentence(index) ? progress[index].sentence : null;
  const feedback = !missingWord ? (saved?.feedback ?? null) : null;
  const feedbackMissing = saved !== null && saved.feedback === null && !checking && !missingWord;

  const submit = () => {
    const sentence = draft.trim();
    if (sentence === "") return;
    if (!sentenceUsesWord(sentence, word.word)) {
      setMissingWord(true);
      return;
    }
    setMissingWord(false);
    setDraft(sentence);
    // The sentence counts now. Its feedback is added when (and if) it arrives.
    onProgress(
      progress.map((entry, i) =>
        i === index ? { ...entry, sentence: { text: sentence, feedback: null } } : entry,
      ),
    );
    void requestFeedback(index, sentence);
  };

  // On the last word, "Next" goes back to a word that still has no sentence, or
  // to the finish screen when there is none. When that is this very word, there
  // is nowhere to go yet.
  const isLast = index === words.length - 1;
  const nextIndex = isLast ? findIndexFrom(0, words.length, (i) => !hasSentence(i)) : index + 1;

  let statusMessage: ReactNode = "";
  if (missingWord) {
    statusMessage = (
      <>
        Try using the word <strong className="font-semibold">{word.word}</strong> in your sentence.
      </>
    );
  } else if (checking) {
    statusMessage = (
      <span className="inline-flex items-center gap-2">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
        Checking your sentence…
      </span>
    );
  } else if (feedbackMissing) {
    statusMessage = "Feedback isn’t available right now.";
  }

  return (
    <StepFrame
      step="sentence"
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
        </div>
        <ul className="space-y-2">
          {word.definitions.map((definition, i) => (
            <DefinitionItem key={i} partOfSpeech={definition.partOfSpeech}>
              {definition.definition}
            </DefinitionItem>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor={inputId} className="block text-sm font-medium text-muted-foreground">
            Write a sentence with this word
          </label>
          {/* A new key for each word focuses the empty box again. */}
          <textarea
            key={word.key}
            id={inputId}
            rows={2}
            value={draft}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends the sentence. A held Enter, Shift+Enter and the Enter
              // that picks an IME candidate do not.
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.repeat ||
                event.nativeEvent.isComposing
              ) {
                return;
              }
              event.preventDefault();
              submit();
            }}
            className="textarea textarea-bordered min-h-11 w-full rounded-[6px] border-border-hairline bg-background/50 text-lg shadow-sm focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <button
          type="button"
          disabled={draft.trim() === ""}
          onClick={submit}
          className="btn btn-primary min-h-11 active:scale-[0.98]"
        >
          Check my sentence
        </button>
      </div>

      <div className="space-y-3">
        {/* The live region stays mounted so that a change in its text is announced. */}
        <p role="status" className="min-h-6 font-medium">
          {statusMessage}
        </p>
        {feedbackMissing && (
          <button
            type="button"
            onClick={() => void requestFeedback(index, saved.text)}
            className="btn btn-outline min-h-11 active:scale-[0.98]"
          >
            Try again
          </button>
        )}
        {feedback && (
          <div className="space-y-2 rounded-[10px] border border-border-hairline bg-accent-tint px-4 py-3">
            <p className="text-lg">{feedback.feedback}</p>
            {feedback.suggestion && (
              <p>
                <span className="font-medium">Another way to say it:</span>{" "}
                <span className="italic">{feedback.suggestion}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
          className="btn btn-outline min-h-11 gap-1.5 active:scale-[0.98]"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          disabled={nextIndex === index}
          onClick={() => goTo(nextIndex)}
          className="btn btn-primary min-h-11 gap-1.5 active:scale-[0.98]"
        >
          Next
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </StepFrame>
  );
}
