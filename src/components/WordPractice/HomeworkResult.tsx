import { useId } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import type { Homework } from "../../types/wordPractice";
import { formatHomeworkDate, formatHomeworkScore } from "./homeworkFormat";

interface HomeworkResultViewProps {
  homework: Homework;
  onBack: () => void;
}

export function HomeworkResultView({ homework, onBack }: HomeworkResultViewProps) {
  const headingId = useId();
  const correctKeys = new Set(homework.result?.correctKeys);

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="btn btn-ghost min-h-11 gap-1.5 active:scale-[0.98]"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
        返回
      </button>

      <div className="space-y-1">
        <h2 id={headingId} className="text-xl font-semibold">
          拼字考試成績
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatHomeworkDate(homework)}・答對 {formatHomeworkScore(homework)}
        </p>
      </div>

      <ul className="divide-y divide-border-hairline overflow-hidden rounded-xl border border-border-hairline bg-card shadow-sm">
        {homework.words.map((word, index) => {
          const answer = homework.progress[index]?.testAnswer ?? null;
          const correct = answer !== null && correctKeys.has(word.key);
          const MarkIcon = correct ? Check : X;
          return (
            <li key={word.key} className="space-y-1 px-4 py-3">
              <p
                className={`flex items-center gap-1.5 text-sm font-medium ${
                  correct ? "text-success" : "text-error"
                }`}
              >
                <MarkIcon className="size-4" strokeWidth={2} aria-hidden="true" />
                {correct ? "答對" : "答錯"}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                <dt className="text-sm text-muted-foreground">你的作答</dt>
                <dd className="break-words">{answer ?? "（未作答）"}</dd>
                <dt className="text-sm text-muted-foreground">正確拼法</dt>
                <dd className="break-words font-medium">{word.word}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
