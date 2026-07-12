import type { ExamTab } from "../../types/exam";

/** ?subject= 的合法值:三個固定科目 + 隨機綜合卷。 */
export function isExamTab(value: string | null): value is ExamTab {
  return (
    value === "chinese" ||
    value === "math" ||
    value === "english" ||
    value === "mixed"
  );
}

export function examTabFromParam(value: string | null): ExamTab {
  return isExamTab(value) ? value : "chinese";
}

export function paramsForTab(tab: ExamTab): Record<string, string> {
  return { subject: tab };
}
