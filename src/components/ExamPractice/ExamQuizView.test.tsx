import { StrictMode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../../services/gameService", () => ({ playSound: vi.fn() }));

import { getExamPaper } from "../../data/exams";
import type { ExamQuizSession } from "../../types/exam";
import { ExamQuizView } from "./ExamQuizView";
import { answerCurrent, createSession, optionCountOf } from "./examSession";

const PAPER = getExamPaper("chinese");
const QUESTIONS = PAPER.sections[0].questions.slice(0, 2);

let container: HTMLDivElement;
let root: Root;

function sessionWithAnswer(isCorrect: boolean): ExamQuizSession {
  const session = createSession({
    subject: "chinese",
    scopeId: "chi-s1",
    scopeLabel: "一、選擇題",
    mode: "normal",
    questions: QUESTIONS,
  });
  const question = session.questions[0];
  const answer = isCorrect
    ? question.answerIndex
    : (question.answerIndex + 1) % optionCountOf(question);
  return answerCurrent(session, answer);
}

function renderQuiz(input: {
  session: ExamQuizSession;
  autoAdvanceOnCorrect: boolean;
  isAutoAdvancePaused?: boolean;
  onNext: () => void;
  onAutoAdvanceOnCorrectChange?: (enabled: boolean) => void;
  onExit?: () => void;
}): void {
  act(() => {
    root.render(
      <StrictMode>
        <ExamQuizView
          autoAdvanceOnCorrect={input.autoAdvanceOnCorrect}
          isAutoAdvancePaused={input.isAutoAdvancePaused ?? false}
          paper={PAPER}
          session={input.session}
          onAutoAdvanceOnCorrectChange={
            input.onAutoAdvanceOnCorrectChange ?? vi.fn()
          }
          onSubmitAnswer={vi.fn()}
          onNext={input.onNext}
          onExit={input.onExit ?? vi.fn()}
        />
      </StrictMode>,
    );
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  container.remove();
});

describe("ExamQuizView auto advance", () => {
  it("advances once after a short correct-answer delay in StrictMode", () => {
    const onNext = vi.fn();
    renderQuiz({
      session: sessionWithAnswer(true),
      autoAdvanceOnCorrect: true,
      onNext,
    });

    act(() => vi.advanceTimersByTime(899));
    expect(onNext).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("does not advance after a wrong answer", () => {
    const onNext = vi.fn();
    renderQuiz({
      session: sessionWithAnswer(false),
      autoAdvanceOnCorrect: true,
      onNext,
    });

    act(() => vi.advanceTimersByTime(2_000));
    expect(onNext).not.toHaveBeenCalled();
  });

  it("cancels the pending timer when unchecked", () => {
    const onNext = vi.fn();
    const onAutoAdvanceOnCorrectChange = vi.fn();
    renderQuiz({
      session: sessionWithAnswer(true),
      autoAdvanceOnCorrect: true,
      onNext,
      onAutoAdvanceOnCorrectChange,
    });

    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeInstanceOf(HTMLInputElement);
    act(() => (checkbox as HTMLInputElement).click());
    expect(onAutoAdvanceOnCorrectChange).toHaveBeenCalledWith(false);

    act(() => vi.advanceTimersByTime(2_000));
    expect(onNext).not.toHaveBeenCalled();
  });

  it("cancels the timer when the next button is used manually", () => {
    const onNext = vi.fn();
    renderQuiz({
      session: sessionWithAnswer(true),
      autoAdvanceOnCorrect: true,
      onNext,
    });

    const nextButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("下一題"),
    );
    expect(nextButton).toBeInstanceOf(HTMLButtonElement);
    act(() => nextButton?.click());
    expect(onNext).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(2_000));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("cancels the timer before opening the exit confirmation", () => {
    const onNext = vi.fn();
    const onExit = vi.fn();
    renderQuiz({
      session: sessionWithAnswer(true),
      autoAdvanceOnCorrect: true,
      onNext,
      onExit,
    });

    const exitButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "離開",
    );
    expect(exitButton).toBeInstanceOf(HTMLButtonElement);
    act(() => exitButton?.click());
    expect(onExit).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(2_000));
    expect(onNext).not.toHaveBeenCalled();
  });

  it("pauses auto advance while a history-exit confirmation is open", () => {
    const onNext = vi.fn();
    const session = sessionWithAnswer(true);
    renderQuiz({
      session,
      autoAdvanceOnCorrect: true,
      onNext,
    });

    renderQuiz({
      session,
      autoAdvanceOnCorrect: true,
      isAutoAdvancePaused: true,
      onNext,
    });

    act(() => vi.advanceTimersByTime(2_000));
    expect(onNext).not.toHaveBeenCalled();

    renderQuiz({
      session,
      autoAdvanceOnCorrect: true,
      isAutoAdvancePaused: false,
      onNext,
    });
    act(() => vi.advanceTimersByTime(900));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
