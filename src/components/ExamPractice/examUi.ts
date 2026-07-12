import type { ExamPaper, ExamQuestion, ExamSubject } from "../../types/exam";
import { EXAM_PAPERS } from "../../data/exams";
import { SUBJECT_LABELS } from "../../data/exams/mixed";

/** 原卷的選項圈號。 */
export const CIRCLED_NUMBERS = ["①", "②", "③", "④"] as const;

const ID_PREFIX_SUBJECTS: readonly [string, ExamSubject][] = [
  ["chi-", "chinese"],
  ["math-", "math"],
  ["eng-", "english"],
];

/** 由題目 id 前綴(chi-/math-/eng-)解析來源科目;未知前綴回 null。 */
function originSubjectOf(question: ExamQuestion): ExamSubject | null {
  const match = ID_PREFIX_SUBJECTS.find(([prefix]) =>
    question.id.startsWith(prefix),
  );
  return match ? match[1] : null;
}

/**
 * 題目的原卷標示。國語卷每大題重新編號,需帶大題名稱才能對照紙本;
 * 數學卷、英文卷為全卷連續編號。隨機綜合卷依題目來源科委派原卷邏輯,
 * 並在最前面加上科名(「國語・二、國字注音・第 3 題」「數學・第 25 題」)。
 */
export function questionLabel(paper: ExamPaper, question: ExamQuestion): string {
  if (paper.subject === "mixed") {
    const origin = originSubjectOf(question);
    if (origin) {
      return `${SUBJECT_LABELS[origin]}・${questionLabel(EXAM_PAPERS[origin], question)}`;
    }
    return `第 ${question.number} 題`;
  }
  if (paper.subject === "chinese") {
    const section = paper.sections.find((item) => item.id === question.sectionId);
    if (section) return `${section.title}・第 ${question.number} 題`;
  }
  return `第 ${question.number} 題`;
}
