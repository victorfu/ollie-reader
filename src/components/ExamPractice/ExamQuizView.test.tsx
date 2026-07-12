import { StrictMode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../../services/gameService", () => ({ playSound: vi.fn() }));

import { getExamPaper } from "../../data/exams";
import type { ExamQuestion, ExamQuizSession } from "../../types/exam";
import { isTextQuestion } from "../../types/exam";
import {
  SpeechContext,
  type SpeechContextType,
} from "../../contexts/SpeechContextType";
import { ExamQuizView } from "./ExamQuizView";
import { answerCurrent, createSession, optionCountOf } from "./examSession";

const PAPER = getExamPaper("chinese");
const QUESTIONS = PAPER.sections[0].questions.slice(0, 2);

const speakMock = vi.fn();

/** ExamQuizView 依賴 SpeechContext(喇叭按鈕/聽寫);測試以 stub 提供。 */
const FAKE_SPEECH: SpeechContextType = {
  speechRate: 1,
  isSpeaking: false,
  ttsMode: "browser",
  ttsEngine: "piper",
  setTtsMode: vi.fn(),
  isLoadingAudio: false,
  speechSupported: true,
  speak: speakMock,
  speakAsync: vi.fn().mockResolvedValue(undefined),
  stopSpeaking: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;

function choiceAnswerOf(question: ExamQuestion, isCorrect: boolean): number {
  if (isTextQuestion(question)) {
    throw new Error("fixture expects a choice question");
  }
  return isCorrect
    ? question.answerIndex
    : (question.answerIndex + 1) % optionCountOf(question);
}

function sessionWithAnswer(isCorrect: boolean): ExamQuizSession {
  const session = createSession({
    subject: "chinese",
    scopeId: "chi-s1",
    scopeLabel: "一、選擇題",
    mode: "normal",
    questions: QUESTIONS,
  });
  return answerCurrent(session, choiceAnswerOf(session.questions[0], isCorrect));
}

function renderQuiz(input: {
  session: ExamQuizSession;
  autoAdvanceOnCorrect: boolean;
  isAutoAdvancePaused?: boolean;
  paper?: typeof PAPER;
  onNext: () => void;
  onAutoAdvanceOnCorrectChange?: (enabled: boolean) => void;
  onSubmitAnswer?: (answer: number | string) => void;
  onExit?: () => void;
}): void {
  act(() => {
    root.render(
      <StrictMode>
        <SpeechContext.Provider value={FAKE_SPEECH}>
          <ExamQuizView
            autoAdvanceOnCorrect={input.autoAdvanceOnCorrect}
            isAutoAdvancePaused={input.isAutoAdvancePaused ?? false}
            paper={input.paper ?? PAPER}
            session={input.session}
            onAutoAdvanceOnCorrectChange={
              input.onAutoAdvanceOnCorrectChange ?? vi.fn()
            }
            onSubmitAnswer={input.onSubmitAnswer ?? vi.fn()}
            onNext={input.onNext}
            onExit={input.onExit ?? vi.fn()}
          />
        </SpeechContext.Provider>
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

describe("ExamQuizView typed questions (english)", () => {
  const ENGLISH_PAPER = getExamPaper("english");
  const TYPED = ENGLISH_PAPER.sections[3].questions;
  const qaQuestion = TYPED.find((q) => isTextQuestion(q) && q.form === "qa");
  const unscrambleQuestion = TYPED.find(
    (q) => isTextQuestion(q) && q.form === "unscramble",
  );
  const dictationQuestion = TYPED.find(
    (q) => isTextQuestion(q) && q.form === "dictation",
  );

  function typedSession(question = qaQuestion): ExamQuizSession {
    if (!question) throw new Error("missing typed fixture");
    return createSession({
      subject: "english",
      scopeId: "eng-s4",
      scopeLabel: "四、句子練習",
      mode: "normal",
      questions: [question],
    });
  }

  function answerInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) throw new Error("answer input not found");
    return input;
  }

  function setInputValue(value: string): void {
    const input = answerInput();
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function submitButton(): HTMLButtonElement {
    const button = [...container.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("送出"),
    );
    if (!button) throw new Error("submit button not found");
    return button as HTMLButtonElement;
  }

  it("renders a text input instead of option buttons", () => {
    renderQuiz({
      session: typedSession(),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    expect(answerInput()).toBeTruthy();
    const circledButtons = [...container.querySelectorAll("button")].filter(
      (button) => button.textContent?.includes("①"),
    );
    expect(circledButtons).toHaveLength(0);
  });

  it("submits the trimmed input via the 送出 button", () => {
    const onSubmitAnswer = vi.fn();
    renderQuiz({
      session: typedSession(),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
      onSubmitAnswer,
    });
    setInputValue("  i am 8  ");
    act(() => submitButton().click());
    expect(onSubmitAnswer).toHaveBeenCalledExactlyOnceWith("i am 8");
  });

  it("submits on Enter but not while composing with an IME", () => {
    const onSubmitAnswer = vi.fn();
    renderQuiz({
      session: typedSession(),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
      onSubmitAnswer,
    });
    setInputValue("yes i can");

    act(() => {
      answerInput().dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      answerInput().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(onSubmitAnswer).not.toHaveBeenCalled();

    act(() => {
      answerInput().dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      );
      answerInput().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(onSubmitAnswer).toHaveBeenCalledExactlyOnceWith("yes i can");
  });

  it("disables input after answering and shows the canonical answer", () => {
    if (!qaQuestion || !isTextQuestion(qaQuestion)) throw new Error("fixture");
    const answered = answerCurrent(typedSession(), "wrong stuff");
    renderQuiz({
      session: answered,
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    expect(answerInput().disabled).toBe(true);
    expect(submitButton().disabled).toBe(true);
    expect(container.textContent).toContain("標準答案");
    expect(container.textContent).toContain(qaQuestion.acceptedAnswers[0]);
    expect(container.textContent).toContain("你的答案：wrong stuff");
  });

  it("renders unscramble hint words as chips", () => {
    if (!unscrambleQuestion || !isTextQuestion(unscrambleQuestion)) {
      throw new Error("fixture");
    }
    renderQuiz({
      session: typedSession(unscrambleQuestion),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    for (const word of unscrambleQuestion.hint?.split("/") ?? []) {
      expect(container.textContent).toContain(word.trim());
    }
  });

  it("keeps the dictation sentence hidden and replays audio on demand", () => {
    if (!dictationQuestion || !isTextQuestion(dictationQuestion)) {
      throw new Error("fixture");
    }
    renderQuiz({
      session: typedSession(dictationQuestion),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    expect(container.textContent).not.toContain(
      dictationQuestion.acceptedAnswers[0],
    );
    const replay = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("播放語音"),
    );
    expect(replay).toBeTruthy();
    act(() => replay?.click());
    expect(speakMock).toHaveBeenCalledWith(dictationQuestion.audioText);
  });

  it("auto-advances after a correct typed answer", () => {
    const onNext = vi.fn();
    renderQuiz({
      session: answerCurrent(typedSession(), "I'm eight years old."),
      autoAdvanceOnCorrect: true,
      onNext,
    });
    act(() => vi.advanceTimersByTime(900));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
