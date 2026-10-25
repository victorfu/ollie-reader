import { CORRECTION_TARGET, wordForKey } from "../../utils/homeworkFlow";
import type { Homework } from "../../types/wordPractice";
import { CopyBoxes } from "./CopyBoxes";

interface CorrectionStepProps {
  homework: Homework;
  wordKey: string;
  onChange: (corrections: Record<string, number>) => void;
}

/** A word that was spelled wrong in dictation: copy the right spelling three times. */
export function CorrectionStep({ homework, wordKey, onChange }: CorrectionStepProps) {
  const word = wordForKey(homework, wordKey);
  const done = homework.corrections[wordKey] ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">訂正：照著打 {CORRECTION_TARGET} 遍</p>
      <p className="text-center text-3xl font-semibold">{word.word}</p>
      <CopyBoxes
        word={word.word}
        done={done}
        target={CORRECTION_TARGET}
        onCorrect={() => onChange({ ...homework.corrections, [wordKey]: done + 1 })}
      />
    </div>
  );
}
