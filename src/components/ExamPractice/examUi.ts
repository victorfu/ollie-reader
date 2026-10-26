import type {
  ExamPaper,
  ExamQuestion,
  ExamScopeId,
  ExamSubject,
  ExamTab,
} from "../../types/exam";
import { FULL_SCOPE_ID } from "../../types/exam";
import { EXAM_PAPERS } from "../../data/exams";
import { MIXED_SCOPE_ID } from "../../data/exams/mixed";
import {
  msg,
  translate,
  type MessageKey,
  type MessageParams,
  type MessageRef,
} from "../../i18n/translate";

/** 翻譯函式(useLanguage().t);預設中文,讓未掛 provider 的呼叫維持原行為。 */
export type Translate = (key: MessageKey, params?: MessageParams) => string;

const zh: Translate = (key, params) => translate("zh-TW", key, params);

/** 原卷的選項圈號。 */
export const CIRCLED_NUMBERS = ["①", "②", "③", "④"] as const;

/** 科目 / tab 的顯示名稱 key。資料層的 SUBJECT_LABELS 不變,只在顯示時翻譯。 */
export const SUBJECT_KEYS: Record<ExamTab, MessageKey> = {
  chinese: "exams.subject.chinese",
  math: "exams.subject.math",
  english: "exams.subject.english",
  mixed: "exams.subject.mixed",
};

/** 卷名 key;資料值(paper.title)保持中文。 */
export const PAPER_TITLE_KEYS: Record<ExamSubject, MessageKey> = {
  chinese: "exams.paper.chinese",
  math: "exams.paper.math",
  english: "exams.paper.english",
};

/** 各大題 id → 顯示名稱 key(對應資料的 section.title)。 */
const SECTION_TITLE_KEYS: Partial<Record<ExamScopeId, MessageKey>> = {
  "chi-s1": "exams.section.chi-s1",
  "chi-s2": "exams.section.chi-s2",
  "chi-s3": "exams.section.chi-s3",
  "chi-s4": "exams.section.chi-s4",
  "chi-s5": "exams.section.chi-s5",
  "math-p1": "exams.section.math-p1",
  "math-p2": "exams.section.math-p2",
  "math-p3": "exams.section.math-p3",
  "math-p4": "exams.section.math-p4",
  "eng-s1": "exams.section.eng-s1",
  "eng-s2": "exams.section.eng-s2",
  "eng-s3": "exams.section.eng-s3",
  "eng-s4": "exams.section.eng-s4",
  [FULL_SCOPE_ID]: "exams.scope.full",
  [MIXED_SCOPE_ID]: "exams.scope.mixed",
};

/** PDF 連結標籤(資料值)→ 顯示 key。 */
const PDF_LABEL_KEYS: Record<string, MessageKey> = {
  題目卷: "exams.pdf.questionPaper",
  解析卷: "exams.pdf.answerExplanations",
  簡答卷: "exams.pdf.answerKey",
  參考講義: "exams.pdf.handout",
};

/** 可交給 <T> 的翻譯描述。 */
export interface ExamMessage {
  k: MessageKey;
  params?: MessageParams;
}

/** 範圍(大題 / 完整測驗 / 隨機卷)的 key;未知 id 回 null(顯示資料值)。 */
export function scopeTitleKey(scopeId: ExamScopeId): MessageKey | null {
  return SECTION_TITLE_KEYS[scopeId] ?? null;
}

/** 範圍的顯示名稱字串;未知 id 退回資料值。 */
export function scopeTitle(
  scopeId: ExamScopeId,
  fallback: string,
  t: Translate = zh,
): string {
  const key = scopeTitleKey(scopeId);
  return key ? t(key) : fallback;
}

/** 範圍名稱當作句子參數:已知 id 交給字典,以便中文提示也用中文名稱。 */
export function scopeTitleParam(
  scopeId: ExamScopeId,
  fallback: string,
): MessageRef | string {
  const key = scopeTitleKey(scopeId);
  return key ? msg(key) : fallback;
}

/** 範圍副標;「第 a~b 題」與「全卷 n 題」可翻譯,其他資料值回 null。 */
export function scopeSubtitleMessage(subtitle: string): ExamMessage | null {
  const range = /^第 (\d+)~(\d+) 題$/.exec(subtitle);
  if (range) {
    return { k: "exams.scope.range", params: { from: range[1], to: range[2] } };
  }
  const full = /^全卷 (\d+) 題$/.exec(subtitle);
  if (full) return { k: "exams.scope.fullSubtitle", params: { n: full[1] } };
  return null;
}

/** PDF 連結標籤(資料值)的 key;未知標籤回 null。 */
export function pdfLabelKey(label: string): MessageKey | null {
  return PDF_LABEL_KEYS[label] ?? null;
}

/** 卷名的 key;隨機綜合卷(動態卷名)回 null。 */
export function paperTitleKey(paper: ExamPaper): MessageKey | null {
  return paper.subject === "mixed" ? null : PAPER_TITLE_KEYS[paper.subject];
}

/** 卷名的顯示文字;隨機綜合卷原樣返回資料值。 */
export function paperTitle(paper: ExamPaper, t: Translate = zh): string {
  return paper.subject === "mixed"
    ? paper.title
    : t(PAPER_TITLE_KEYS[paper.subject]);
}

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
export function questionLabel(
  paper: ExamPaper,
  question: ExamQuestion,
  t: Translate = zh,
): string {
  const numbered = () => t("exams.question.number", { n: question.number });
  if (paper.subject === "mixed") {
    const origin = originSubjectOf(question);
    if (origin) {
      return t("exams.question.withSubject", {
        subject: t(SUBJECT_KEYS[origin]),
        label: questionLabel(EXAM_PAPERS[origin], question, t),
      });
    }
    return numbered();
  }
  if (paper.subject === "chinese") {
    const section = paper.sections.find((item) => item.id === question.sectionId);
    if (section) {
      return t("exams.question.withSection", {
        section: scopeTitle(section.id, section.title, t),
        n: question.number,
      });
    }
  }
  return numbered();
}
