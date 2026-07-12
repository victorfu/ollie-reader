import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamSubject } from "../types/exam";
import { optionCountOf } from "../components/ExamPractice/examSession";
import { useExamQuiz, type UseExamQuizReturn } from "./useExamQuiz";

let latestQuiz: UseExamQuizReturn | null = null;
let container: HTMLDivElement;
let root: Root;

function captureQuiz(nextQuiz: UseExamQuizReturn): void {
  latestQuiz = nextQuiz;
}

function Harness({ subject }: { subject: ExamSubject }) {
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

function answerCurrentWrong(): void {
  const current = quiz().session;
  if (!current) throw new Error("no active session");
  const question = current.questions[current.currentIndex];
  const wrongAnswer = (question.answerIndex + 1) % optionCountOf(question);
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
});
