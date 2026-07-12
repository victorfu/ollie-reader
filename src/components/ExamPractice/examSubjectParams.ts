import type { ExamSubject } from "../../types/exam";

export function isExamSubject(value: string | null): value is ExamSubject {
  return value === "chinese" || value === "math";
}

export function examSubjectFromParam(value: string | null): ExamSubject {
  return isExamSubject(value) ? value : "chinese";
}

export function paramsForSubject(
  subject: ExamSubject,
): Record<string, string> {
  return { subject };
}
