import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyWord } from "../../types/vocabulary";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
  stopListening: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, element) => element,
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../../hooks/useSpeechState", () => ({
  useSpeechState: () => ({
    speak: mocks.speak,
    stopSpeaking: mocks.stopSpeaking,
    isSpeaking: false,
  }),
}));
vi.mock("../../hooks/usePronunciation", () => ({
  usePronunciation: () => ({
    isListening: false,
    transcript: "",
    startListening: vi.fn(),
    stopListening: mocks.stopListening,
    isSupported: false,
    error: null,
  }),
}));

import { FlashcardMode } from "./FlashcardMode";

const word: VocabularyWord = {
  id: "word-1",
  userId: "user-1",
  word: "apple",
  definitions: [{ partOfSpeech: "noun", definition: "a fruit" }],
  examples: [],
  synonyms: [],
  antonyms: [],
  tags: [],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  reviewCount: 0,
};

const secondWord: VocabularyWord = {
  ...word,
  id: "word-2",
  word: "banana",
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe("FlashcardMode review persistence", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
  });

  const button = (label: string) => {
    const match = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.includes(label),
    );
    if (!(match instanceof HTMLButtonElement)) {
      throw new Error(`Button not found: ${label}`);
    }
    return match;
  };

  it("submits one result at a time and stays on the card when saving fails", async () => {
    const firstSave = deferred<{ success: boolean; message?: string }>();
    const onUpdateReview = vi
      .fn()
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValueOnce({ success: true });

    act(() => {
      root = createRoot(container);
      root.render(
        <FlashcardMode
          words={[word]}
          onClose={vi.fn()}
          onUpdateReview={onUpdateReview}
        />,
      );
    });

    act(() => button("翻看答案").click());
    const rememberButton = button("記住了");
    act(() => {
      rememberButton.click();
      rememberButton.click();
    });
    expect(onUpdateReview).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve({ success: false, message: "網路暫時無法連線" });
      await firstSave.promise;
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "網路暫時無法連線",
    );
    expect(container.textContent).toContain("apple");
    expect(container.textContent).not.toContain("複習完成");

    await act(async () => {
      button("記住了").click();
      await Promise.resolve();
    });

    expect(onUpdateReview).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("複習完成");
    expect(container.textContent).toContain("1");
  });

  it("freezes card navigation until an in-flight review finishes", async () => {
    const save = deferred<{ success: boolean }>();
    const onUpdateReview = vi.fn().mockReturnValue(save.promise);

    act(() => {
      root = createRoot(container);
      root.render(
        <FlashcardMode
          words={[word, secondWord]}
          onClose={vi.fn()}
          onUpdateReview={onUpdateReview}
        />,
      );
    });

    act(() => button("翻看答案").click());
    act(() => button("記住了").click());

    const card = container.querySelector(".perspective-1000");
    if (!(card instanceof HTMLElement)) throw new Error("card not found");
    act(() => card.click());

    const nextButton = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.includes("下一個"),
    );
    if (nextButton instanceof HTMLButtonElement) {
      act(() => nextButton.click());
    }

    await act(async () => {
      save.resolve({ success: true });
      await save.promise;
    });

    expect(container.textContent).toContain("banana");
    expect(container.textContent).toContain("2 / 2");
    expect(container.textContent).not.toContain("3 / 2");
  });
});
