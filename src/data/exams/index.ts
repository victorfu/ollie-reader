import type {
  ExamPaper,
  ExamQuestion,
  ExamScope,
  ExamScopeId,
  ExamSubject,
} from "../../types/exam";
import { FULL_SCOPE_ID } from "../../types/exam";
import { chinesePaper } from "./chinese";
import { mathPaper } from "./math";

export const EXAM_PAPERS: Record<ExamSubject, ExamPaper> = {
  chinese: chinesePaper,
  math: mathPaper,
};

export function getExamPaper(subject: ExamSubject): ExamPaper {
  return EXAM_PAPERS[subject];
}

export function getAllQuestions(paper: ExamPaper): readonly ExamQuestion[] {
  return paper.sections.flatMap((section) => section.questions);
}

/** 練習範圍清單:各大題 + 整卷。 */
export function listScopes(paper: ExamPaper): ExamScope[] {
  const sectionScopes = paper.sections.map((section) => ({
    id: section.id,
    title: section.title,
    subtitle: section.subtitle,
    questionCount: section.questions.length,
  }));
  return [
    ...sectionScopes,
    {
      id: FULL_SCOPE_ID,
      title: "完整測驗",
      subtitle: `全卷 ${paper.totalQuestions} 題`,
      questionCount: paper.totalQuestions,
    },
  ];
}

export function getScopeLabel(paper: ExamPaper, scopeId: ExamScopeId): string {
  if (scopeId === FULL_SCOPE_ID) return "完整測驗";
  return (
    paper.sections.find((section) => section.id === scopeId)?.title ?? scopeId
  );
}

/** 取得範圍內的題目(原卷順序);未知 scopeId 回傳 null。 */
export function getScopeQuestions(
  paper: ExamPaper,
  scopeId: ExamScopeId,
): readonly ExamQuestion[] | null {
  if (scopeId === FULL_SCOPE_ID) return getAllQuestions(paper);
  const section = paper.sections.find((item) => item.id === scopeId);
  return section ? section.questions : null;
}

/** 依 id 找回題目(保持原卷順序),未知 id 靜默略過——資料修訂後仍安全。 */
export function findQuestionsByIds(
  paper: ExamPaper,
  ids: readonly string[],
): ExamQuestion[] {
  const wanted = new Set(ids);
  return getAllQuestions(paper).filter((question) => wanted.has(question.id));
}
