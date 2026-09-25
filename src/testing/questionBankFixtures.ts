import type {
  BankQuestion,
  QuestionSource,
  SourcePage,
} from "../types/questionBank";

const FIXED_DATE = new Date("2026-09-01T00:00:00Z");

export function makePage(overrides: Partial<SourcePage> = {}): SourcePage {
  return {
    storagePath: "question-bank/user-1/source-1/page-0.jpg",
    width: 1000,
    height: 1400,
    masks: [],
    ...overrides,
  };
}

export function makeSource(
  overrides: Partial<QuestionSource> = {},
): QuestionSource {
  return {
    id: "source-1",
    userId: "user-1",
    title: "四上數學月考",
    subject: "math",
    pages: [makePage()],
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}

export function makeQuestion(
  overrides: Partial<BankQuestion> = {},
): BankQuestion {
  return {
    id: "question-1",
    userId: "user-1",
    sourceId: "source-1",
    subject: "math",
    regions: [{ pageIndex: 0, box: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 } }],
    answerSpace: "none",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}
