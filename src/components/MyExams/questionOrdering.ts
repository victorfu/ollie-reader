import type {
  BankQuestion,
  Box,
  QuestionSource,
} from "../../types/questionBank";

function byCreation(a: BankQuestion, b: BankQuestion): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

/** 同一來源內：依框選順序（createdAt），不依位置（spec §6）。 */
export function sortQuestionsInSource(
  questions: readonly BankQuestion[],
): BankQuestion[] {
  return [...questions].sort(byCreation);
}

/** 題庫列表：來源由新到舊分組，組內依框選順序；找不到來源的題目放最後。 */
export function orderBankQuestions(
  questions: readonly BankQuestion[],
  sources: readonly QuestionSource[],
): BankQuestion[] {
  const rank = new Map(
    [...sources]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((source, index) => [source.id, index]),
  );
  const rankOf = (question: BankQuestion) =>
    rank.get(question.sourceId) ?? Number.MAX_SAFE_INTEGER;
  return [...questions].sort(
    (a, b) => rankOf(a) - rankOf(b) || byCreation(a, b),
  );
}

export interface PageRegionEntry {
  question: BankQuestion;
  /** 題目在來源內的序號（1 起算）。 */
  number: number;
  regionIndex: number;
  box: Box;
  /** 不是該題的第一個區塊。 */
  isContinuation: boolean;
}

/** 某一頁上的所有區塊；sorted 必須已經過 sortQuestionsInSource。 */
export function regionsOnPage(
  sorted: readonly BankQuestion[],
  pageIndex: number,
): PageRegionEntry[] {
  return sorted.flatMap((question, index) =>
    question.regions.flatMap((region, regionIndex) =>
      region.pageIndex === pageIndex
        ? [
            {
              question,
              number: index + 1,
              regionIndex,
              box: region.box,
              isContinuation: regionIndex > 0,
            },
          ]
        : [],
    ),
  );
}

export interface PageQuestionEntry {
  question: BankQuestion;
  number: number;
  /** 這題的第一個區塊不在這一頁（跨頁的接續）。 */
  isContinuation: boolean;
}

/** 右側清單：在這一頁有任何區塊的題目（每題一次）。 */
export function questionsOnPage(
  sorted: readonly BankQuestion[],
  pageIndex: number,
): PageQuestionEntry[] {
  return sorted.flatMap((question, index) =>
    question.regions.some((region) => region.pageIndex === pageIndex)
      ? [
          {
            question,
            number: index + 1,
            isContinuation: question.regions[0].pageIndex !== pageIndex,
          },
        ]
      : [],
  );
}
