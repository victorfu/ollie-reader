import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { useSpeechState } from "../../hooks/useSpeechState";
import { dictationAnswer, dictationId, wordForKey } from "../../utils/homeworkFlow";
import type { DictationItem, Homework } from "../../types/wordPractice";
import { AnswerInput } from "./AnswerInput";
import { PracticeText } from "./PracticeText";
import { T } from "../common/T";

interface DictationStepProps {
  homework: Homework;
  itemIndex: number;
  onChange: (dictation: DictationItem[]) => void;
}

/**
 * One dictation question: the word is said, then its sentence, then the word
 * again. Ollie types it once. A form item says the inflected form and names
 * which form of which word it is. Nothing on screen says whether it was right, and
 * neither the answer nor any earlier answer is ever rendered.
 */
export function DictationStep({ homework, itemIndex, onChange }: DictationStepProps) {
  const { speakAsync, stopSpeaking } = useSpeechState();
  const { dictation } = homework;
  const current = dictation[itemIndex];
  const word = wordForKey(homework, current.key);
  const spoken = { word: dictationAnswer(homework, current), sentence: word.sentence };
  const itemId = dictationId(current);
  const formKind = current.form ? word.inflection?.kind : undefined;

  const [value, setValue] = useState("");
  // Counts "再聽一次" presses, which each start the words over.
  const [replays, setReplays] = useState(0);
  // The playback that failed, as "<item id>:<replays>"; once the question or the
  // replay count changes it no longer matches and the error is gone.
  const [failedPlayback, setFailedPlayback] = useState<string | null>(null);

  const latestRef = useRef({ speakAsync, stopSpeaking, word: spoken.word, sentence: spoken.sentence });
  useEffect(() => {
    latestRef.current = { speakAsync, stopSpeaking, word: spoken.word, sentence: spoken.sentence };
  });

  useEffect(() => {
    const playbackId = `${itemId}:${replays}`;
    let cancelled = false;
    const { word, sentence } = latestRef.current;
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
  }, [itemId, replays]);

  const record = (patch: Partial<DictationItem>) => {
    onChange(dictation.map((entry, i) => (i === itemIndex ? { ...entry, ...patch } : entry)));
    setValue("");
  };

  const submit = () => {
    const answer = value.trim();
    if (answer === "") return;
    record({ answer, skipped: false });
  };

  const replay = () => setReplays((count) => count + 1);
  const playbackFailed = failedPlayback === `${itemId}:${replays}`;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">
        <T k="practice.dictation.counter" params={{ current: itemIndex + 1, total: dictation.length }} />
      </p>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-muted-foreground">
          <T k="practice.dictation.instructions" />
        </p>
        {formKind && (
          <p className="text-sm">
            <PracticeText k="practice.dictation.formHint" params={{ word: word.word }} inflection={formKind} />
          </p>
        )}
        <button type="button" onClick={replay} className="btn btn-outline min-h-11 gap-2 active:scale-[0.98]">
          <Volume2 className="size-5 text-accent" strokeWidth={1.75} aria-hidden="true" />
          <T k="practice.dictation.replay" />
        </button>
      </div>

      {playbackFailed && (
        <div
          role="alert"
          className="flex flex-wrap gap-2 rounded-[10px] border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
        >
          <button type="button" onClick={replay} className="btn btn-outline btn-sm min-h-11 active:scale-[0.98]">
            <T k="practice.dictation.playFailed" />
          </button>
          <button
            type="button"
            onClick={() => record({ answer: null, skipped: true })}
            className="btn btn-ghost btn-sm min-h-11 active:scale-[0.98]"
          >
            <T k="practice.dictation.skip" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <AnswerInput key={itemId} value={value} onChange={setValue} onSubmit={submit} label={<T k="practice.dictation.inputLabel" />} />
        </div>
        <button
          type="button"
          disabled={value.trim() === ""}
          onClick={submit}
          className="btn btn-primary min-h-11 active:scale-[0.98]"
        >
          <T k="practice.dictation.next" />
        </button>
      </div>
    </div>
  );
}
