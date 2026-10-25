import type {
  DictationItem,
  Homework,
  HomeworkProgress,
  WordPageProgress,
} from "../../types/wordPractice";
import { currentPosition } from "../../utils/homeworkFlow";
import { CorrectionStep } from "./CorrectionStep";
import { DictationStep } from "./DictationStep";
import { WordPage } from "./WordPage";

interface HomeworkBookProps {
  homework: Homework;
  onProgress: (next: HomeworkProgress) => void;
  onRest: () => void;
  onSubmit: () => void;
  /** The homework is being handed in. */
  submitting: boolean;
  /** Another homework is being made; nothing here can be changed meanwhile. */
  locked?: boolean;
}

function hasWord(homework: Homework, key: string): boolean {
  return [...homework.newWords, ...homework.reviewWords].some((word) => word.key === key);
}

/** The full-page homework book: follows `currentPosition` to a word page, the dictation, a correction or the submit button. */
export function HomeworkBook({
  homework,
  onProgress,
  onRest,
  onSubmit,
  submitting,
  locked = false,
}: HomeworkBookProps) {
  const position = currentPosition(homework);
  const { pages, dictation, corrections } = homework;

  const total = pages.length + dictation.length;
  const finished =
    pages.filter((page) => page.section === "done").length +
    dictation.filter((item) => item.skipped || item.answer !== null).length;
  const percent = total === 0 ? 0 : Math.round((finished / total) * 100);

  const setPage = (index: number, next: WordPageProgress) =>
    onProgress({ pages: pages.map((page, i) => (i === index ? next : page)), dictation, corrections });
  const setDictation = (next: DictationItem[]) => onProgress({ pages, dictation: next, corrections });
  const setCorrections = (next: Record<string, number>) =>
    onProgress({ pages, dictation, corrections: next });

  let step = null;
  if (position.phase === "page") {
    const word = homework.newWords[position.wordIndex];
    const page = pages[position.wordIndex];
    if (word && page) {
      step = (
        <WordPage
          key={word.key}
          word={word}
          progress={page}
          index={position.wordIndex}
          total={homework.newWords.length}
          onChange={(next) => setPage(position.wordIndex, next)}
        />
      );
    }
  } else if (position.phase === "dictation") {
    const item = dictation[position.itemIndex];
    if (item && hasWord(homework, item.key)) {
      step = (
        <DictationStep
          key={item.key}
          homework={homework}
          itemIndex={position.itemIndex}
          onChange={setDictation}
        />
      );
    }
  } else if (position.phase === "correction") {
    if (hasWord(homework, position.key)) {
      step = (
        <CorrectionStep
          key={position.key}
          homework={homework}
          wordKey={position.key}
          onChange={setCorrections}
        />
      );
    }
  } else {
    step = (
      <div className="space-y-4 text-center">
        <p className="text-lg">全部寫完了，可以交作業囉！</p>
        <button
          type="button"
          disabled={submitting || locked}
          onClick={onSubmit}
          className="btn btn-primary btn-lg min-h-14 active:scale-[0.98]"
        >
          {submitting && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
          交作業
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <progress
          className="progress progress-primary flex-1"
          value={percent}
          max={100}
          aria-label="功課進度"
        />
        <button
          type="button"
          disabled={submitting || locked}
          onClick={onRest}
          className="btn btn-ghost btn-sm min-h-11 active:scale-[0.98]"
        >
          先休息，等一下再寫
        </button>
      </div>

      <fieldset disabled={locked || submitting} className="min-w-0 border-0 p-0">
        {step ?? (
          <p role="alert" className="text-sm text-error">
            這份功課的資料有問題，請先休息再回來。
          </p>
        )}
      </fieldset>
    </div>
  );
}
