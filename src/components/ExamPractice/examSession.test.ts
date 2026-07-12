import { describe, expect, it } from "vitest";
import type { ExamQuestion } from "../../types/exam";
import {
  advance,
  answerCurrent,
  createSession,
  isLastQuestion,
  optionCountOf,
  scoreOf,
  wrongAnswersOf,
} from "./examSession";

function makeQuestion(overrides: Partial<ExamQuestion> & { id: string }): ExamQuestion {
  return {
    number: 1,
    sectionId: "math-p1",
    text: "測試題",
    options: ["甲", "乙", "丙", "丁"],
    answerIndex: 1,
    ...overrides,
  };
}

const QUESTIONS: readonly ExamQuestion[] = [
  makeQuestion({ id: "math-001", number: 1, answerIndex: 1 }),
  makeQuestion({ id: "math-002", number: 2, answerIndex: 0 }),
  makeQuestion({ id: "math-003", number: 3, answerIndex: 3 }),
];

function startSession(questions = QUESTIONS) {
  return createSession({
    subject: "math",
    scopeId: "math-p1",
    scopeLabel: "第一部分",
    mode: "normal",
    questions,
  });
}

describe("createSession", () => {
  it("initializes with null answers and preserves question order exactly", () => {
    const session = startSession();
    expect(session.answers).toEqual([null, null, null]);
    expect(session.currentIndex).toBe(0);
    expect(session.isAnswered).toBe(false);
    // 順序不變式:進 session 的題目順序 = 出 session 的順序,永不重排
    expect(session.questions.map((q) => q.id)).toEqual([
      "math-001",
      "math-002",
      "math-003",
    ]);
  });
});

describe("answerCurrent", () => {
  it("records the chosen option and marks correctness", () => {
    const session = answerCurrent(startSession(), 1);
    expect(session.answers[0]).toBe(1);
    expect(session.isAnswered).toBe(true);
    expect(session.lastAnswerCorrect).toBe(true);
  });

  it("marks wrong answers", () => {
    const session = answerCurrent(startSession(), 2);
    expect(session.lastAnswerCorrect).toBe(false);
  });

  it("ignores a second answer while feedback is showing (double-tap guard)", () => {
    const first = answerCurrent(startSession(), 2);
    const second = answerCurrent(first, 1);
    expect(second).toBe(first);
    expect(second.answers[0]).toBe(2);
  });

  it("ignores out-of-range or non-integer option indexes", () => {
    const session = startSession();
    expect(answerCurrent(session, -1)).toBe(session);
    expect(answerCurrent(session, 4)).toBe(session);
    expect(answerCurrent(session, 1.5)).toBe(session);
  });

  it("respects optionCount for image-contained-option questions", () => {
    const twoOption = makeQuestion({
      id: "math-025",
      options: undefined,
      image: "math-q25.png",
      imageContainsOptions: true,
      optionCount: 2,
      answerIndex: 1,
    });
    const session = startSession([twoOption]);
    expect(optionCountOf(twoOption)).toBe(2);
    expect(answerCurrent(session, 2)).toBe(session);
    expect(answerCurrent(session, 1).lastAnswerCorrect).toBe(true);
  });
});

describe("advance", () => {
  it("does nothing before the current question is answered", () => {
    const session = startSession();
    expect(advance(session)).toBe(session);
  });

  it("moves to the next question and clears feedback state", () => {
    const answered = answerCurrent(startSession(), 1);
    const next = advance(answered);
    expect(next.currentIndex).toBe(1);
    expect(next.isAnswered).toBe(false);
    expect(next.lastAnswerCorrect).toBeNull();
  });

  it("stays on the last question", () => {
    let session = startSession();
    session = advance(answerCurrent(session, 1));
    session = advance(answerCurrent(session, 0));
    session = answerCurrent(session, 3);
    expect(isLastQuestion(session)).toBe(true);
    expect(advance(session)).toBe(session);
  });
});

describe("scoreOf / wrongAnswersOf", () => {
  it("counts correct answers and lists wrong ones in original order", () => {
    let session = startSession();
    session = advance(answerCurrent(session, 2)); // Q1 錯(正解 1)
    session = advance(answerCurrent(session, 0)); // Q2 對
    session = answerCurrent(session, 0); // Q3 錯(正解 3)

    expect(scoreOf(session)).toBe(1);
    const wrong = wrongAnswersOf(session);
    expect(wrong.map((w) => w.question.id)).toEqual(["math-001", "math-003"]);
    expect(wrong.map((w) => w.chosen)).toEqual([2, 0]);
  });

  it("ignores unanswered questions when scoring", () => {
    const session = answerCurrent(startSession(), 1);
    expect(scoreOf(session)).toBe(1);
    expect(wrongAnswersOf(session)).toEqual([]);
  });
});
