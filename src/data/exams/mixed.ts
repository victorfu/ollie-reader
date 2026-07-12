import type {
  ExamPaper,
  ExamQuestion,
  ExamSubject,
} from "../../types/exam";
import { EXAM_PAPERS, getAllQuestions } from "./index";

/** 隨機綜合卷的唯一 scope id(≠ FULL_SCOPE_ID,不觸發區段統計 interstitial)。 */
export const MIXED_SCOPE_ID = "mixed-random";

export const MIXED_MIN_QUESTIONS = 10;

/** 抽題順序 = 卷面順序:國語 → 數學 → 英文。 */
export const MIXED_SUBJECTS: readonly ExamSubject[] = [
  "chinese",
  "math",
  "english",
];

/** 科目顯示名稱(綜合卷字幕、原卷標示、tab 切換器共用)。 */
export const SUBJECT_LABELS: Record<ExamSubject, string> = {
  chinese: "國語",
  math: "數學",
  english: "英文",
};

/** 三科題庫總數(目前 300);上限由資料推導,不寫死。 */
export const MIXED_POOL_TOTAL = MIXED_SUBJECTS.reduce(
  (sum, subject) => sum + EXAM_PAPERS[subject].totalQuestions,
  0,
);

/** 題數下拉選項:10、20、…、題庫總數(間距 10)。 */
export function mixedCountOptions(): number[] {
  const options: number[] = [];
  for (
    let count = MIXED_MIN_QUESTIONS;
    count <= MIXED_POOL_TOTAL;
    count += 10
  ) {
    options.push(count);
  }
  return options;
}

type Rng = () => number;

/**
 * 平均拆分:各科 ⌊count/3⌋,餘數隨機分給不同科
 * (count ≤ 題庫總數時每科配額必 ≤ 該科題數,不需再 clamp)。
 */
function splitEvenly(count: number, rng: Rng): Record<ExamSubject, number> {
  const base = Math.floor(count / MIXED_SUBJECTS.length);
  let remainder = count % MIXED_SUBJECTS.length;
  const counts = Object.fromEntries(
    MIXED_SUBJECTS.map((subject) => [subject, base]),
  ) as Record<ExamSubject, number>;

  const lucky = [...MIXED_SUBJECTS];
  // Fisher–Yates 打散,前 remainder 科各 +1
  for (let index = lucky.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [lucky[index], lucky[swap]] = [lucky[swap], lucky[index]];
  }
  for (const subject of lucky) {
    if (remainder === 0) break;
    counts[subject] += 1;
    remainder -= 1;
  }
  return counts;
}

/** 不放回抽 k 題,回傳時保留原卷順序(隨機性只在「選哪些題」)。 */
function sampleInPaperOrder(
  pool: readonly ExamQuestion[],
  k: number,
  rng: Rng,
): ExamQuestion[] {
  if (k >= pool.length) return [...pool];
  const indices = pool.map((_, index) => index);
  // 部分 Fisher–Yates:只洗出前 k 個位置
  for (let index = 0; index < k; index += 1) {
    const swap = index + Math.floor(rng() * (indices.length - index));
    [indices[index], indices[swap]] = [indices[swap], indices[index]];
  }
  const picked = new Set(indices.slice(0, k));
  return pool.filter((_, index) => picked.has(index));
}

/**
 * 產生一張隨機綜合卷:三科平均分配、各科不放回抽樣(卷內不重複——
 * 三科 id 空間又互斥)、依國→數→英分區、各科內照原卷順序。
 * 單一 section(id = MIXED_SCOPE_ID),restart/getScopeQuestions 直接可用。
 */
export function buildMixedPaper(
  count: number,
  rng: Rng = Math.random,
): ExamPaper {
  const clamped = Math.min(
    Math.max(Math.floor(count), MIXED_MIN_QUESTIONS),
    MIXED_POOL_TOTAL,
  );
  const counts = splitEvenly(clamped, rng);
  const parts = MIXED_SUBJECTS.map((subject) => ({
    subject,
    questions: sampleInPaperOrder(
      getAllQuestions(EXAM_PAPERS[subject]),
      counts[subject],
      rng,
    ),
  }));

  const questions = parts.flatMap((part) => part.questions);
  const subtitle = parts
    .map((part) => `${SUBJECT_LABELS[part.subject]} ${part.questions.length} 題`)
    .join("・");

  return {
    subject: "mixed",
    title: `隨機綜合卷（${clamped} 題）`,
    totalQuestions: clamped,
    sections: [
      {
        id: MIXED_SCOPE_ID,
        title: "隨機綜合卷",
        subtitle,
        questions,
      },
    ],
  };
}
