import { useState } from "react";
import { Check } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import { isAnswerCorrect } from "../../utils/answerMatch";
import { AnswerInput } from "./AnswerInput";
import { SpellingDiff } from "./SpellingDiff";
import { T } from "../common/T";

interface CopyBoxesProps {
  word: string;
  done: number;
  target: number;
  onCorrect: () => void;
}

/**
 * A row of writing boxes like a practice book: the first `done` are filled in
 * green, the next one takes the typing, the rest wait. A wrong copy is marked
 * letter by letter and cleared; it costs nothing.
 */
export function CopyBoxes({ word, done, target, onCorrect }: CopyBoxesProps) {
  const { t } = useLanguage();
  const [typed, setTyped] = useState("");
  const [missed, setMissed] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const check = () => {
    if (isAnswerCorrect(typed, word)) {
      setTyped("");
      setMissed(null);
      onCorrect();
      return;
    }
    setMissed(typed.trim());
    setAttempts(attempts + 1);
    setTyped("");
  };

  return (
    <div className="space-y-3">
      <ol className="grid gap-2 sm:grid-cols-3">
        {Array.from({ length: target }, (_, i) => {
          if (i < done) {
            return (
              <li
                key={i}
                className="flex min-h-11 items-center justify-between gap-2 rounded-[6px] border border-success bg-success/10 px-3 text-lg"
              >
                <span className="break-words">{word}</span>
                <Check className="size-5 shrink-0 text-success" strokeWidth={2} aria-label={t("practice.copy.correct")} />
              </li>
            );
          }
          if (i === done) {
            return (
              <li key={i}>
                <AnswerInput
                  key={`${done}-${attempts}`}
                  value={typed}
                  onChange={setTyped}
                  onSubmit={check}
                  label={<T k="practice.copy.attempt" params={{ n: i + 1 }} />}
                />
              </li>
            );
          }
          return (
            <li
              key={i}
              aria-label={t("practice.copy.waiting", { n: i + 1 })}
              className="min-h-11 rounded-[6px] border border-dashed border-border-hairline"
            />
          );
        })}
      </ol>
      {missed !== null && (
        <div
          role="status"
          className="space-y-2 rounded-[10px] border border-border-hairline bg-background px-4 py-3"
        >
          <p className="text-sm text-muted-foreground">
            <T k="practice.copy.lookAgain" />
          </p>
          <SpellingDiff input={missed} expected={word} />
        </div>
      )}
    </div>
  );
}
