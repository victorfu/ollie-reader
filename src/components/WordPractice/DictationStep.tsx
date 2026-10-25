import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { useSpeechState } from "../../hooks/useSpeechState";
import { dictationAnswer, dictationId, wordForKey } from "../../utils/homeworkFlow";
import { INFLECTION_LABEL } from "../../utils/inflection";
import type { DictationItem, Homework } from "../../types/wordPractice";
import { AnswerInput } from "./AnswerInput";

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
  const formHint = current.form && word.inflection ? `${word.word} 的${INFLECTION_LABEL[word.inflection.kind]}` : null;

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
        聽寫 {itemIndex + 1} / {dictation.length}
      </p>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-muted-foreground">聽一聽，打出你聽到的字。</p>
        {formHint && <p className="text-sm">提示：{formHint}</p>}
        <button type="button" onClick={replay} className="btn btn-outline min-h-11 gap-2 active:scale-[0.98]">
          <Volume2 className="size-5 text-accent" strokeWidth={1.75} aria-hidden="true" />
          再聽一次
        </button>
      </div>

      {playbackFailed && (
        <div
          role="alert"
          className="flex flex-wrap gap-2 rounded-[10px] border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
        >
          <button type="button" onClick={replay} className="btn btn-outline btn-sm min-h-11 active:scale-[0.98]">
            播放失敗，再試一次
          </button>
          <button
            type="button"
            onClick={() => record({ answer: null, skipped: true })}
            className="btn btn-ghost btn-sm min-h-11 active:scale-[0.98]"
          >
            跳過這題
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <AnswerInput key={itemId} value={value} onChange={setValue} onSubmit={submit} label="打出你聽到的字" />
        </div>
        <button
          type="button"
          disabled={value.trim() === ""}
          onClick={submit}
          className="btn btn-primary min-h-11 active:scale-[0.98]"
        >
          下一題
        </button>
      </div>
    </div>
  );
}
