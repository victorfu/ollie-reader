import { useId } from "react";
import { ChevronRight } from "lucide-react";
import type { Homework } from "../../types/wordPractice";
import { formatHomeworkDate, formatHomeworkScore } from "./homeworkFormat";

interface HomeworkHistoryProps {
  history: Homework[];
  onOpen: (homeworkId: string) => void;
}

export function HomeworkHistory({ history, onOpen }: HomeworkHistoryProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-xl font-semibold">
        歷史成績
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">還沒有完成的功課。</p>
      ) : (
        <ul className="divide-y divide-border-hairline overflow-hidden rounded-xl border border-border-hairline bg-card shadow-sm">
          {history.map((homework) => (
            <li key={homework.id}>
              <button
                type="button"
                onClick={() => onOpen(homework.id)}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <span className="flex-1">{formatHomeworkDate(homework)}</span>
                <span className="font-medium tabular-nums">{formatHomeworkScore(homework)}</span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
