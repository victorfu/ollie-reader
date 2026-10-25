import { CORRECTION_TARGET, dictationAnswer, findDictationItem } from "../../utils/homeworkFlow";
import type { Homework } from "../../types/wordPractice";
import { CopyBoxes } from "./CopyBoxes";

interface CorrectionStepProps {
  homework: Homework;
  /** The dictation item id. */
  itemId: string;
  onChange: (corrections: Record<string, number>) => void;
}

/** A word that was spelled wrong in dictation: copy the right spelling three times. */
export function CorrectionStep({ homework, itemId, onChange }: CorrectionStepProps) {
  const item = findDictationItem(homework, itemId);
  if (!item) return null;
  const answer = dictationAnswer(homework, item);
  const done = homework.corrections[itemId] ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">訂正：照著打 {CORRECTION_TARGET} 遍</p>
      <p className="text-center text-3xl font-semibold">{answer}</p>
      <CopyBoxes
        word={answer}
        done={done}
        target={CORRECTION_TARGET}
        onCorrect={() => onChange({ ...homework.corrections, [itemId]: done + 1 })}
      />
    </div>
  );
}
