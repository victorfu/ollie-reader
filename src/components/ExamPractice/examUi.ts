import type { ExamPaper, ExamQuestion } from "../../types/exam";

/** 原卷的選項圈號。 */
export const CIRCLED_NUMBERS = ["①", "②", "③", "④"] as const;

/**
 * 題目的原卷標示。國語卷每大題重新編號,需帶大題名稱才能對照紙本;
 * 數學卷為全卷連續編號。
 */
export function questionLabel(paper: ExamPaper, question: ExamQuestion): string {
  if (paper.subject === "chinese") {
    const section = paper.sections.find((item) => item.id === question.sectionId);
    if (section) return `${section.title}・第 ${question.number} 題`;
  }
  return `第 ${question.number} 題`;
}
