import { useId } from "react";
import { BookOpen } from "lucide-react";
import type { Homework, PracticeSettings } from "../../types/wordPractice";
import { currentPosition } from "../../utils/homeworkFlow";

interface TodayCardProps {
  settings: PracticeSettings;
  reviewDueCount: number;
  active: Homework | null;
  /** A homework is being made; the buttons wait. */
  starting: boolean;
  onStart: () => void;
  onContinue: () => void;
}

function continueLabel(homework: Homework): string {
  const position = currentPosition(homework);
  switch (position.phase) {
    case "page":
      return `繼續寫功課（第 ${position.wordIndex + 1} / ${homework.newWords.length} 個字）`;
    case "dictation":
      return "繼續寫功課（聽寫）";
    case "correction":
      return "繼續寫功課（訂正）";
    case "submit":
      return "繼續寫功課（交作業）";
  }
}

/** The card on the home screen: today's homework to start, or the one in progress to continue. */
export function TodayCard({
  settings,
  reviewDueCount,
  active,
  starting,
  onStart,
  onContinue,
}: TodayCardProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border border-border-hairline bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex items-center gap-3">
        <BookOpen className="size-6 shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
        <h2 id={headingId} className="text-xl font-semibold">
          {active ? "進行中的功課" : "今天的功課"}
        </h2>
      </div>

      {active ? (
        <button
          type="button"
          disabled={starting}
          onClick={onContinue}
          className="btn btn-primary btn-lg min-h-14 w-full active:scale-[0.98]"
        >
          {continueLabel(active)}
        </button>
      ) : (
        <>
          <p className="text-lg">
            {settings.newWordCount} 個新字・{reviewDueCount} 個複習字
          </p>
          <button
            type="button"
            disabled={starting}
            onClick={onStart}
            className="btn btn-primary btn-lg min-h-14 w-full active:scale-[0.98]"
          >
            {starting && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
            開始寫功課
          </button>
        </>
      )}
    </section>
  );
}
