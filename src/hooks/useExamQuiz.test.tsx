import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamQuestion, ExamTab } from "../types/exam";
import { FULL_SCOPE_ID, isTextQuestion } from "../types/exam";
import { MIXED_SCOPE_ID } from "../data/exams/mixed";
import { optionCountOf } from "../components/ExamPractice/examSession";
import { useExamQuiz, type UseExamQuizReturn } from "./useExamQuiz";

let latestQuiz: UseExamQuizReturn | null = null;
let container: HTMLDivElement;
let root: Root;

function captureQuiz(nextQuiz: UseExamQuizReturn): void {
  latestQuiz = nextQuiz;
}

function Harness({ subject }: { subject: ExamTab }) {
  const nextQuiz = useExamQuiz(subject);
  useEffect(() => {
    captureQuiz(nextQuiz);
  }, [nextQuiz]);
  return null;
}

function quiz(): UseExamQuizReturn {
  if (!latestQuiz) throw new Error("quiz harness has not rendered");
  return latestQuiz;
}

function asChoice(question: ExamQuestion) {
  if (isTextQuestion(question)) {
    throw new Error("test harness expects a choice question");
  }
  return question;
}

function answerCurrentWrong(): void {
  const current = quiz().session;
  if (!current) throw new Error("no active session");
  const question = asChoice(current.questions[current.currentIndex]);
  const wrongAnswer = (question.answerIndex + 1) % optionCountOf(question);
  act(() => quiz().submitAnswer(wrongAnswer));
}

function answerCurrentCorrect(): void {
  const current = quiz().session;
  if (!current) throw new Error("no active session");
  const question = asChoice(current.questions[current.currentIndex]);
  act(() => quiz().submitAnswer(question.answerIndex));
}

/** 綜合卷可能抽到英文打字題,依題型送一個必錯的作答。 */
function answerCurrentWrongAnyKind(): void {
  const current = quiz().session;
  if (!current) throw new Error("no active session");
  const question = current.questions[current.currentIndex];
  const wrongAnswer = isTextQuestion(question)
    ? "___wrong___"
    : (question.answerIndex + 1) % optionCountOf(question);
  act(() => quiz().submitAnswer(wrongAnswer));
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  latestQuiz = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness subject="chinese" />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("useExamQuiz", () => {
  it("retries the current result even when persisted progress disappears", () => {
    act(() => quiz().startSession("chi-s1"));
    const total = quiz().session?.questions.length ?? 0;
    expect(total).toBe(8);

    for (let index = 0; index < total; index += 1) {
      answerCurrentWrong();
      act(() => quiz().nextQuestion());
    }

    expect(quiz().phase).toBe("finished");
    expect(quiz().result?.wrong).toHaveLength(total);
    expect(quiz().sectionResult).toBeNull();

    window.localStorage.clear();
    act(() => quiz().retryWrong());

    expect(quiz().phase).toBe("active");
    expect(quiz().session?.mode).toBe("retry");
    expect(quiz().session?.questions).toHaveLength(total);
  });

  it("settles and persists the last question only once on duplicate completion", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    act(() => quiz().startSession("chi-s1"));
    const total = quiz().session?.questions.length ?? 0;

    for (let index = 0; index < total - 1; index += 1) {
      answerCurrentWrong();
      act(() => quiz().nextQuestion());
    }
    answerCurrentWrong();

    act(() => {
      quiz().nextQuestion();
      quiz().nextQuestion();
    });

    expect(quiz().phase).toBe("finished");
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("pauses after each full-exam section and reports that section accuracy", () => {
    act(() => quiz().startSession(FULL_SCOPE_ID));

    for (let index = 0; index < 8; index += 1) {
      if (index < 5) {
        answerCurrentCorrect();
      } else {
        answerCurrentWrong();
      }
      act(() => quiz().nextQuestion());
    }

    expect(quiz().phase).toBe("active");
    expect(quiz().session?.currentIndex).toBe(7);
    expect(quiz().sectionResult).toEqual({
      sectionId: "chi-s1",
      sectionLabel: "一、選擇題",
      score: 5,
      total: 8,
      isFinalSection: false,
    });

    act(() => quiz().continueAfterSection());

    expect(quiz().session?.currentIndex).toBe(8);
    expect(quiz().sectionResult).toBeNull();
  });

  it("persists the overall result before showing the final section stats", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    act(() => quiz().startSession(FULL_SCOPE_ID));
    const total = quiz().session?.questions.length ?? 0;

    for (let index = 0; index < total; index += 1) {
      answerCurrentCorrect();
      act(() => quiz().nextQuestion());
      if (quiz().sectionResult && !quiz().sectionResult?.isFinalSection) {
        act(() => quiz().continueAfterSection());
      }
    }

    expect(quiz().phase).toBe("finished");
    expect(quiz().sectionResult).toMatchObject({
      sectionId: "chi-s5",
      score: 11,
      total: 11,
      isFinalSection: true,
    });
    expect(setItem).toHaveBeenCalledTimes(1);

    act(() => {
      quiz().continueAfterSection();
      quiz().continueAfterSection();
    });

    expect(quiz().phase).toBe("finished");
    expect(quiz().result).toMatchObject({ score: 100, total: 100 });
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});

describe("useExamQuiz mixed random paper", () => {
  beforeEach(() => {
    act(() => root.render(<Harness subject="mixed" />));
  });

  it("has no paper until one is generated", () => {
    expect(quiz().paper).toBeNull();
    expect(quiz().phase).toBe("idle");
  });

  it("finishes a random paper without ever touching localStorage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    act(() => quiz().startRandomSession(10));

    expect(quiz().phase).toBe("active");
    expect(quiz().paper?.subject).toBe("mixed");
    expect(quiz().session?.scopeId).toBe(MIXED_SCOPE_ID);
    expect(quiz().session?.questions).toHaveLength(10);

    for (let index = 0; index < 10; index += 1) {
      answerCurrentWrongAnyKind();
      act(() => quiz().nextQuestion());
    }

    expect(quiz().phase).toBe("finished");
    expect(quiz().sectionResult).toBeNull();
    expect(quiz().result?.wrong).toHaveLength(10);
    expect(quiz().result?.isNewBest).toBe(false);
    expect(setItem).not.toHaveBeenCalled();

    // 當次錯題重練(in-memory)照常可用
    act(() => quiz().retryWrong());
    expect(quiz().phase).toBe("active");
    expect(quiz().session?.mode).toBe("retry");
    expect(quiz().session?.questions).toHaveLength(10);
  });

  it("restarts with the exact same generated paper", () => {
    act(() => quiz().startRandomSession(10));
    const firstIds = quiz().session?.questions.map((question) => question.id);
    expect(firstIds).toHaveLength(10);

    for (let index = 0; index < 10; index += 1) {
      answerCurrentWrongAnyKind();
      act(() => quiz().nextQuestion());
    }
    expect(quiz().phase).toBe("finished");

    act(() => quiz().restart());
    expect(quiz().phase).toBe("active");
    expect(quiz().session?.mode).toBe("normal");
    expect(quiz().session?.questions.map((question) => question.id)).toEqual(
      firstIds,
    );

    // 回列表丟棄這張卷,下次要重新產生
    act(() => quiz().exitToHub());
    expect(quiz().phase).toBe("idle");
    expect(quiz().paper).toBeNull();
  });
});
