import type { HistoryHomework, Homework } from "../../types/wordPractice";

/** Whether a stored homework is one of the homework book (an older one has no `version`). */
export function isHomeworkBook(homework: HistoryHomework): homework is Homework {
  return "version" in homework && homework.version === 2;
}

/** The day a completed homework was finished, in the zh-TW format of the app. */
export function formatHomeworkDate(homework: HistoryHomework): string {
  return new Date(homework.completedAt ?? homework.createdAt).toLocaleDateString("zh-TW");
}

/** `correct / total` for a completed homework; a dash when it has no result. */
export function formatHomeworkScore(homework: HistoryHomework): string {
  const { result } = homework;
  return result ? `${result.correctCount} / ${result.total}` : "—";
}
