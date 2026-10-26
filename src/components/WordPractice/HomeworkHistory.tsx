import { useId } from "react";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import type { HistoryHomework } from "../../types/wordPractice";
import { formatHomeworkDate, formatHomeworkScore } from "./homeworkFormat";
import { T } from "../common/T";

interface HomeworkHistoryProps {
  history: HistoryHomework[];
  onOpen: (homeworkId: string) => void;
}

export function HomeworkHistory({ history, onOpen }: HomeworkHistoryProps) {
  const headingId = useId();
  const { t, language } = useLanguage();
  const locale = language === "en" ? "en-US" : "zh-TW";

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-xl font-semibold">
        <T k="practice.history.title" />
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <T k="practice.history.empty" />
        </p>
      ) : (
        <ul className="divide-y divide-border-hairline overflow-hidden rounded-xl border border-border-hairline bg-card shadow-sm">
          {history.map((homework) => (
            <li key={homework.id}>
              <button
                type="button"
                onClick={() => onOpen(homework.id)}
                aria-label={
                  homework.result
                    ? t("practice.history.itemLabel", {
                        date: formatHomeworkDate(homework, locale),
                        score: formatHomeworkScore(homework),
                      })
                    : formatHomeworkDate(homework, locale)
                }
                className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <span className="flex-1">{formatHomeworkDate(homework, locale)}</span>
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
