import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Volume2 } from "lucide-react";
import { useSpeechState } from "../../../hooks/useSpeechState";
import { AnswerInput } from "../AnswerInput";
import type { StepProps } from "../stepTypes";
import { findIndexFrom, nextWordIndex } from "./stepHelpers";
import { StepFrame } from "./stepParts";

interface SpellingTestStepProps extends StepProps {
  /** Hands the test in. Resolves when that is over, whether or not the homework was completed. */
  onFinish: () => Promise<void>;
}

/**
 * Step 6: a spelling test like the ones at school. Each word is said, then its
 * sentence, then the word again, and the learner types it. Each word gets one
 * answer, and nothing says whether it was right until the test is handed in.
 */
export function SpellingTestStep({ homework, onProgress, onExit, onFinish }: SpellingTestStepProps) {
  const { speakAsync, stopSpeaking } = useSpeechState();
  const { words, progress } = homework;

  // -1 once every word has an answer: the learner finds the "Finish test" button.
  const [index, setIndex] = useState(() =>
    findIndexFrom(0, words.length, (i) => progress[i].testAnswer === null),
  );
  const [value, setValue] = useState("");
  // Counts "Hear it again" and "Try again" presses, which each start the words over.
  const [replays, setReplays] = useState(0);
  // The playback that failed, as "<word>:<replays>". Once the learner is on another
  // word or has pressed a button again, it no longer matches and the error is gone.
  const [failedPlayback, setFailedPlayback] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);

  // The playback below must not start over when the speech settings change or
  // when a missing sentence arrives, so it reads what it needs from here.
  const latestRef = useRef({ words, speakAsync, stopSpeaking });
  useEffect(() => {
    latestRef.current = { words, speakAsync, stopSpeaking };
  });

  // Say the question when it comes up, and again whenever the learner asks. Leaving
  // the question or the step cuts the audio off.
  useEffect(() => {
    if (index === -1) return undefined;
    const playbackId = `${index}:${replays}`;
    let cancelled = false;

    const { word, sentence } = latestRef.current.words[index];
    const sequence = sentence ? [word, sentence, word] : [word, word];
    void (async () => {
      try {
        for (const part of sequence) {
          if (cancelled) return;
          await latestRef.current.speakAsync(part, { reportErrors: true });
        }
      } catch {
        if (!cancelled) setFailedPlayback(playbackId);
      }
    })();

    return () => {
      cancelled = true;
      latestRef.current.stopSpeaking();
    };
  }, [index, replays]);

  const finish = async () => {
    // The ref answers a second click before the first one has re-rendered the button.
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await onFinish();
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  if (index === -1) {
    return (
      // Leaving while the test is being handed in would drop the learner on the result later.
      <StepFrame step="test" onExit={finishing ? undefined : onExit}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-10 text-success" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-lg font-semibold">You answered every word.</p>
          <p className="text-muted-foreground">Finish the test to see how you did.</p>
          <button
            type="button"
            autoFocus
            disabled={finishing}
            onClick={() => void finish()}
            className="btn btn-primary mt-2 min-h-11 active:scale-[0.98]"
          >
            {finishing && (
              <span className="loading loading-spinner loading-sm" aria-hidden="true" />
            )}
            Finish test
          </button>
        </div>
      </StepFrame>
    );
  }

  const word = words[index];
  const playbackFailed = failedPlayback === `${index}:${replays}`;

  const submit = () => {
    const answer = value.trim();
    if (answer === "") return;
    const next = progress.map((entry, i) => (i === index ? { ...entry, testAnswer: answer } : entry));
    onProgress(next);
    setIndex(nextWordIndex(index, next.length, (i) => next[i].testAnswer === null));
    setValue("");
  };

  const replay = () => setReplays((count) => count + 1);

  return (
    <StepFrame
      step="test"
      position={{ current: index + 1, total: words.length }}
      onExit={onExit}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-muted-foreground">Listen, then type the word you hear.</p>
        <button
          type="button"
          onClick={replay}
          className="btn btn-outline min-h-11 gap-2 active:scale-[0.98]"
        >
          <Volume2 className="size-5 text-accent" strokeWidth={1.75} aria-hidden="true" />
          Hear it again
        </button>
      </div>

      {playbackFailed && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-[10px] border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
        >
          <p>
            The audio didn’t play. Try again, or change the speech setting in Settings.
          </p>
          <button
            type="button"
            onClick={replay}
            className="btn btn-outline btn-sm min-h-11 active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          {/* A new key for each word focuses the empty box again. */}
          <AnswerInput
            key={word.key}
            value={value}
            onChange={setValue}
            onSubmit={submit}
            label="Type the word you heard"
          />
        </div>
        <button
          type="button"
          disabled={value.trim() === ""}
          onClick={submit}
          className="btn btn-primary min-h-11 active:scale-[0.98]"
        >
          Next
        </button>
      </div>
    </StepFrame>
  );
}
