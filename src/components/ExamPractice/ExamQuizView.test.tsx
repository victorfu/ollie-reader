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
import {
  advance,
  answerCurrent,
  createSession,
  optionCountOf,
} from "./examSession";

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
/** jsdom 沒有 scrollIntoView/scrollTo 實作;以 spy 驗證捲動管理。 */
let scrollIntoViewMock: ReturnType<typeof vi.fn>;
let scrollToMock: ReturnType<typeof vi.fn>;

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
  scrollIntoViewMock = vi.fn();
  Element.prototype.scrollIntoView =
    scrollIntoViewMock as unknown as typeof Element.prototype.scrollIntoView;
  scrollToMock = vi.fn();
  window.scrollTo = scrollToMock as unknown as typeof window.scrollTo;
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

  it("freezes the input after answering and shows the canonical answer", () => {
    if (!qaQuestion || !isTextQuestion(qaQuestion)) throw new Error("fixture");
    const answered = answerCurrent(typedSession(), "wrong stuff");
    renderQuiz({
      session: answered,
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    // 不 disabled:焦點要留在輸入框上,iOS 螢幕鍵盤才不會收合
    expect(answerInput().disabled).toBe(false);
    expect(answerInput().getAttribute("aria-readonly")).toBe("true");
    setInputValue("more typing");
    expect(answerInput().value).toBe("");
    expect(submitButton().disabled).toBe(true);
    expect(container.textContent).toContain("標準答案");
    expect(container.textContent).toContain(qaQuestion.acceptedAnswers[0]);
    expect(container.textContent).toContain("你的答案：wrong stuff");
  });

  it("advances with Enter from the frozen input after answering", () => {
    const onNext = vi.fn();
    renderQuiz({
      session: answerCurrent(typedSession(), "whatever"),
      autoAdvanceOnCorrect: false,
      onNext,
    });
    act(() => {
      answerInput().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("focuses the input for qa questions but not for unscramble", () => {
    renderQuiz({
      session: typedSession(),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    expect(document.activeElement).toBe(answerInput());

    if (!unscrambleQuestion) throw new Error("fixture");
    renderQuiz({
      session: typedSession(unscrambleQuestion),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    expect(document.activeElement).not.toBe(answerInput());
  });

  it("composes the unscramble answer by tapping word chips", () => {
    if (!unscrambleQuestion || !isTextQuestion(unscrambleQuestion)) {
      throw new Error("fixture");
    }
    const onSubmitAnswer = vi.fn();
    renderQuiz({
      session: typedSession(unscrambleQuestion),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
      onSubmitAnswer,
    });
    const words = (unscrambleQuestion.hint ?? "")
      .split("/")
      .map((word) => word.trim());
    const chip = (word: string): HTMLButtonElement => {
      const button = container.querySelector<HTMLButtonElement>(
        `button[aria-label="加入單字 ${word}"]`,
      );
      if (!button) throw new Error(`chip not found: ${word}`);
      return button;
    };

    act(() => chip(words[0]).click());
    act(() => chip(words[1]).click());
    expect(answerInput().value).toBe(`${words[0]} ${words[1]}`);
    expect(chip(words[0]).disabled).toBe(true);

    const clearButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("清除重來"),
    );
    expect(clearButton).toBeTruthy();
    act(() => clearButton?.click());
    expect(answerInput().value).toBe("");
    expect(chip(words[0]).disabled).toBe(false);

    for (const word of words) {
      act(() => chip(word).click());
    }
    act(() => submitButton().click());
    expect(onSubmitAnswer).toHaveBeenCalledExactlyOnceWith(words.join(" "));
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

describe("ExamQuizView scroll management", () => {
  function freshSession(): ExamQuizSession {
    return createSession({
      subject: "chinese",
      scopeId: "chi-s1",
      scopeLabel: "一、選擇題",
      mode: "normal",
      questions: QUESTIONS,
    });
  }

  it("scrolls the feedback into view after answering, not before", () => {
    const session = freshSession();
    renderQuiz({ session, autoAdvanceOnCorrect: false, onNext: vi.fn() });
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    renderQuiz({
      session: answerCurrent(
        session,
        choiceAnswerOf(session.questions[0], false),
      ),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("returns to the top when the question changes, but not on mount", () => {
    const session = freshSession();
    renderQuiz({ session, autoAdvanceOnCorrect: false, onNext: vi.fn() });
    expect(scrollToMock).not.toHaveBeenCalled();

    const advanced = advance(
      answerCurrent(session, choiceAnswerOf(session.questions[0], false)),
    );
    renderQuiz({
      session: advanced,
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    expect(advanced.currentIndex).toBe(1);
    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ top: 0 }),
    );
  });
});

describe("ExamQuizView touch layout", () => {
  function choiceSession(options: [string, string, string, string]): ExamQuizSession {
    const question: ExamQuestion = {
      id: "layout-1",
      number: 1,
      sectionId: "chi-s1",
      text: "測試題",
      options,
      answerIndex: 0,
    };
    return createSession({
      subject: "chinese",
      scopeId: "chi-s1",
      scopeLabel: "一、選擇題",
      mode: "normal",
      questions: [question],
    });
  }

  it("uses a two-column grid on sm+ when every option is short", () => {
    renderQuiz({
      session: choiceSession(["yellow", "monkey", "juice", "desk"]),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    const grid = container.querySelector(".grid");
    expect(grid?.className).toContain("sm:grid-cols-2");
  });

  it("keeps a single column when any option is long", () => {
    renderQuiz({
      session: choiceSession([
        "yellow",
        "monkey",
        "juice",
        "這是一個超過十四個字的超級無敵長選項文字",
      ]),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    const grid = container.querySelector(".grid");
    expect(grid?.className).not.toContain("sm:grid-cols-2");
  });

  it("marks the keyboard shortcut hint as fine-pointer-only", () => {
    renderQuiz({
      session: choiceSession(["a", "b", "c", "d"]),
      autoAdvanceOnCorrect: false,
      onNext: vi.fn(),
    });
    const hint = [...container.querySelectorAll("p")].find((paragraph) =>
      paragraph.textContent?.includes("數字鍵"),
    );
    expect(hint).toBeTruthy();
    expect(hint?.className).toContain("hidden");
    expect(hint?.className).toContain("pointer-fine:block");
  });
});
