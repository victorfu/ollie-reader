import { describe, expect, it } from "vitest";
import type {
  ExamChoiceQuestion,
  ExamQuestion,
  ExamTextQuestion,
} from "../../types/exam";
import {
  advance,
  answerCurrent,
  createSession,
  isCorrectAnswer,
  isEndOfSection,
  isLastQuestion,
  optionCountOf,
  sectionStatsAtCurrent,
  scoreOf,
  wrongAnswersOf,
} from "./examSession";

function makeQuestion(
  overrides: Partial<ExamChoiceQuestion> & { id: string },
): ExamChoiceQuestion {
  return {
    number: 1,
    sectionId: "math-p1",
    text: "測試題",
    options: ["甲", "乙", "丙", "丁"],
    answerIndex: 1,
    ...overrides,
  };
}

function makeTextQuestion(
  overrides: Partial<ExamTextQuestion> & { id: string },
): ExamTextQuestion {
  return {
    kind: "text",
    form: "qa",
    number: 1,
    sectionId: "eng-s4",
    text: "How old are you?",
    hint: "8",
    acceptedAnswers: ["I'm eight years old.", "I'm eight."],
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

describe("section boundaries", () => {
  const SECTIONED_QUESTIONS: readonly ExamQuestion[] = [
    makeQuestion({ id: "math-001", sectionId: "math-p1", answerIndex: 1 }),
    makeQuestion({ id: "math-002", sectionId: "math-p1", answerIndex: 0 }),
    makeQuestion({ id: "math-026", sectionId: "math-p2", answerIndex: 3 }),
  ];

  it("detects a section boundary before the next section", () => {
    let session = startSession(SECTIONED_QUESTIONS);
    expect(isEndOfSection(session)).toBe(false);
    session = advance(answerCurrent(session, 1));
    expect(isEndOfSection(session)).toBe(true);
  });

  it("calculates the current contiguous section accuracy", () => {
    let session = startSession(SECTIONED_QUESTIONS);
    session = advance(answerCurrent(session, 1));
    session = answerCurrent(session, 2);

    expect(sectionStatsAtCurrent(session)).toEqual({
      sectionId: "math-p1",
      score: 1,
      total: 2,
    });
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

describe("typed (text) questions", () => {
  const textQuestions: readonly ExamQuestion[] = [
    makeTextQuestion({ id: "eng-076", number: 76 }),
    makeTextQuestion({
      id: "eng-086",
      number: 86,
      form: "unscramble",
      text: "把下面的單字排成正確的句子。",
      hint: "down / sit / please",
      acceptedAnswers: ["Sit down, please."],
    }),
  ];

  function startTextSession(questions = textQuestions) {
    return createSession({
      subject: "english",
      scopeId: "eng-s4",
      scopeLabel: "四、句子練習",
      mode: "normal",
      questions,
    });
  }

  it("has zero option count (digit shortcuts disabled)", () => {
    expect(optionCountOf(textQuestions[0])).toBe(0);
  });

  it("accepts a lenient variant and stores the raw trimmed input", () => {
    const session = answerCurrent(startTextSession(), "  i am 8  ");
    expect(session.isAnswered).toBe(true);
    expect(session.lastAnswerCorrect).toBe(true);
    expect(session.answers[0]).toBe("i am 8");
  });

  it("marks wrong content as incorrect but still records it", () => {
    const session = answerCurrent(startTextSession(), "I am ten");
    expect(session.lastAnswerCorrect).toBe(false);
    expect(session.answers[0]).toBe("I am ten");
  });

  it("rejects empty, whitespace-only, and non-string answers", () => {
    const session = startTextSession();
    expect(answerCurrent(session, "")).toBe(session);
    expect(answerCurrent(session, "   ")).toBe(session);
    expect(answerCurrent(session, 1)).toBe(session);
  });

  it("rejects string answers on choice questions", () => {
    const session = startSession();
    expect(answerCurrent(session, "乙")).toBe(session);
  });

  it("keeps the double-answer guard for typed input", () => {
    const first = answerCurrent(startTextSession(), "wrong answer");
    const second = answerCurrent(first, "I'm eight");
    expect(second).toBe(first);
    expect(second.answers[0]).toBe("wrong answer");
  });

  it("scores mixed choice + text sessions via isCorrectAnswer", () => {
    const mixed: readonly ExamQuestion[] = [
      makeQuestion({ id: "eng-001", number: 1, sectionId: "eng-s1", answerIndex: 0 }),
      ...textQuestions,
    ];
    let session = createSession({
      subject: "english",
      scopeId: "full",
      scopeLabel: "完整測驗",
      mode: "normal",
      questions: mixed,
    });
    session = advance(answerCurrent(session, 0)); // choice 對
    session = advance(answerCurrent(session, "im eight years old")); // text 對
    session = answerCurrent(session, "please sit down"); // unscramble 錯序 → 錯

    expect(scoreOf(session)).toBe(2);
    const wrong = wrongAnswersOf(session);
    expect(wrong.map((w) => w.question.id)).toEqual(["eng-086"]);
    expect(wrong.map((w) => w.chosen)).toEqual(["please sit down"]);
  });

  it("isCorrectAnswer treats null as wrong for both kinds", () => {
    expect(isCorrectAnswer(textQuestions[0], null)).toBe(false);
    expect(isCorrectAnswer(makeQuestion({ id: "x" }), null)).toBe(false);
  });
});
