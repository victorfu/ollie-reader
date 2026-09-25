export type BankSubject = "chinese" | "math" | "english" | "science" | "social";

/** 顯示順序即組卷時的科目排列順序。 */
export const BANK_SUBJECTS: readonly BankSubject[] = [
  "chinese",
  "math",
  "english",
  "science",
  "social",
];

export const BANK_SUBJECT_LABELS: Record<BankSubject, string> = {
  chinese: "國語",
  math: "數學",
  english: "英文",
  science: "自然",
  social: "社會",
};

export function isBankSubject(value: unknown): value is BankSubject {
  return (
    typeof value === "string" &&
    (BANK_SUBJECTS as readonly string[]).includes(value)
  );
}

/** 0–1 的相對座標，原點是頁面圖片左上角。 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SourcePage {
  /** Supabase 路徑：question-bank/{uid}/{sourceId}/page-{index}.jpg */
  storagePath: string;
  /** 頁面圖片的像素尺寸（計算長寬比用）。 */
  width: number;
  height: number;
  /** 白色遮蓋框；該頁所有題目共用。 */
  masks: Box[];
}

/** Firestore collection: questionSources（一次上傳一筆）。 */
export interface QuestionSource {
  id: string;
  userId: string;
  title: string;
  /** 該來源題目的預設科目。 */
  subject: BankSubject;
  pages: SourcePage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionRegion {
  pageIndex: number;
  box: Box;
}

export type AnswerSpace = "none" | "small" | "medium" | "large";

export const ANSWER_SPACES: readonly AnswerSpace[] = [
  "none",
  "small",
  "medium",
  "large",
];

export const ANSWER_SPACE_LABELS: Record<AnswerSpace, string> = {
  none: "無",
  small: "小",
  medium: "中",
  large: "大",
};

export function isAnswerSpace(value: unknown): value is AnswerSpace {
  return (
    typeof value === "string" &&
    (ANSWER_SPACES as readonly string[]).includes(value)
  );
}

/** Firestore collection: bankQuestions。 */
export interface BankQuestion {
  id: string;
  userId: string;
  sourceId: string;
  subject: BankSubject;
  /** 至少一個；列印時由上往下接續（跨欄、跨頁的題目）。 */
  regions: [QuestionRegion, ...QuestionRegion[]];
  /** 選填的簡短答案，印在答案頁。 */
  answer?: string;
  /** 題目下方額外的作答留白。 */
  answerSpace: AnswerSpace;
  createdAt: Date;
  updatedAt: Date;
}

/** Firestore collection: examSheets（M2 使用）。 */
export interface ExamSheet {
  id: string;
  userId: string;
  title: string;
  /** 有順序；引用的題目可能已被刪除（列印時跳過）。 */
  questionIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
