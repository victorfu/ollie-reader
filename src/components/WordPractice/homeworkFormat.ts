import type { Homework } from "../../types/wordPractice";

/** The day a completed homework was finished, in the app's zh-TW format. */
export function formatHomeworkDate(homework: Homework): string {
  return new Date(homework.completedAt ?? homework.createdAt).toLocaleDateString("zh-TW");
}

/** `correct / total` for a completed homework; a dash when it has no result. */
export function formatHomeworkScore(homework: Homework): string {
  const { result } = homework;
  return result ? `${result.correctCount} / ${result.total}` : "—";
}
