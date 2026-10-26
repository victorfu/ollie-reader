import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../../services/gameService", () => ({ playSound: vi.fn() }));

import { QuizCard } from "./QuizCard";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { QuizQuestion } from "../../types/game";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderCard(
  question: QuizQuestion,
  over: Partial<{
    isAnswered: boolean;
    lastAnswerCorrect: boolean | null;
    onAnswer: (answer: number | string) => void;
    onNext: () => void;
    speak: (text: string) => void;
  }> = {},
) {
  act(() =>
    root.render(
      <LanguageProvider>
        <QuizCard
          question={question}
          questionIndex={0}
          totalQuestions={5}
          timeLeft={60}
          timeLimit={60}
          isAnswered={over.isAnswered ?? false}
          lastAnswerCorrect={over.lastAnswerCorrect ?? null}
          onAnswer={over.onAnswer ?? vi.fn()}
          onNext={over.onNext}
          speak={over.speak}
        />
      </LanguageProvider>,
    ),
  );
}

const buttons = () => [...container.querySelectorAll("button")];
const buttonNamed = (text: string) =>
  buttons().find((b) => b.textContent?.trim() === text);

describe("QuizCard new question kinds", () => {
  it("dictation reads the word aloud, hides the meaning, then reveals both", () => {
    const speak = vi.fn();
    const question: QuizQuestion = {
      kind: "dictation",
      word: "cat",
      letters: ["t", "a", "c"],
      hint: "貓",
    };
    renderCard(question, { speak });
    expect(speak).toHaveBeenCalledWith("cat");
    expect(container.textContent).not.toContain("貓");

    renderCard(question, { speak, isAnswered: true, lastAnswerCorrect: false });
    expect(container.textContent).toContain("貓");
    expect(container.textContent).toContain("cat");
  });

  it("typing submits what the player typed", () => {
    const onAnswer = vi.fn();
    renderCard({ kind: "typing", word: "apple", hint: "蘋果" }, { onAnswer });
    const input = container.querySelector("input");
    if (!input) throw new Error("missing input");
    expect(input.getAttribute("autocapitalize")).toBe("none");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "Apple");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input.form?.requestSubmit();
    });
    expect(onAnswer).toHaveBeenCalledWith("Apple");
  });

  it("synonym shows the relation and English options", () => {
    renderCard({
      kind: "synonym",
      word: "happy",
      relation: "opposite",
      options: ["sad", "dog", "run", "book"],
      correctIndex: 0,
    });
    expect(container.textContent).toContain("反義");
    expect(container.textContent).toContain("選出意思相反的字！");
    expect(buttonNamed("1sad")).toBeDefined();
  });

  it("pos labels each option and reveals the label when wrong", () => {
    const question: QuizQuestion = {
      kind: "pos",
      word: "quickly",
      hint: "快速地",
      options: ["noun", "verb", "adjective", "adverb"],
      correctIndex: 3,
    };
    renderCard(question);
    expect(container.textContent).toContain("名詞 noun");
    expect(container.textContent).toContain("副詞 adverb");

    renderCard(question, { isAnswered: true, lastAnswerCorrect: false });
    expect(container.textContent).toContain("正確答案是「副詞 adverb」");
  });

  it("order builds the sentence from word chips and holds after a right answer", () => {
    const onAnswer = vi.fn();
    const question: QuizQuestion = {
      kind: "order",
      word: "happy",
      tokens: ["happy", "I", "am"],
      sentence: "I am happy",
      translation: "我很快樂",
    };
    renderCard(question, { onAnswer });
    expect(container.textContent).toContain("我很快樂");
    for (const token of ["I", "am", "happy"]) {
      act(() => buttonNamed(token)?.click());
    }
    act(() => buttonNamed("完成")?.click());
    expect(onAnswer).toHaveBeenCalledWith("I am happy");

    const onNext = vi.fn();
    renderCard(question, { isAnswered: true, lastAnswerCorrect: true, onNext });
    expect(buttonNamed("下一題")).toBeDefined();
  });

  it("listenCloze reads the whole sentence aloud without the meaning hint", () => {
    const speak = vi.fn();
    renderCard(
      {
        kind: "listenCloze",
        word: "quickly",
        prompt: "She ran _____ home.",
        hint: "快速地",
        options: ["quickly", "dog", "run", "book"],
        correctIndex: 0,
        sentence: "She ran quickly home.",
      },
      { speak },
    );
    expect(speak).toHaveBeenCalledWith("She ran quickly home.");
    expect(container.textContent).toContain("She ran _____ home.");
    expect(container.textContent).not.toContain("快速地");
  });

  it("a held Enter key does not skip the reveal after a wrong answer", () => {
    const onNext = vi.fn();
    renderCard(
      { kind: "typing", word: "apple", hint: "蘋果" },
      { isAnswered: true, lastAnswerCorrect: false, onNext },
    );
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", repeat: true }),
      );
    });
    expect(onNext).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("number keys only answer option questions", () => {
    const onAnswer = vi.fn();
    renderCard({ kind: "typing", word: "apple", hint: "蘋果" }, { onAnswer });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
    });
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
