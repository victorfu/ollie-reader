import { act, useEffect, useState, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type {
  Homework,
  HomeworkWord,
  HomeworkWordProgress,
  SentenceFeedback,
} from "../../../types/wordPractice";
import { emptyProgress } from "../../../utils/homeworkProgress";
import type { StepProps } from "../stepTypes";
import { SentenceStep } from "./SentenceStep";
import { SpellingTestStep } from "./SpellingTestStep";

const ai = vi.hoisted(() => ({ getSentenceFeedback: vi.fn() }));
vi.mock("../../../services/wordPracticeAi", () => ({
  getSentenceFeedback: ai.getSentenceFeedback,
}));

const speech = vi.hoisted(() => ({ speakAsync: vi.fn(), stopSpeaking: vi.fn() }));
vi.mock("../../../hooks/useSpeechState", () => ({
  useSpeechState: () => ({ speakAsync: speech.speakAsync, stopSpeaking: speech.stopSpeaking }),
}));

const log = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("../../../utils/logger", () => ({ logger: { error: log.error } }));

const CHINESE = /[㐀-鿿]/;
const SPEAK_OPTIONS = { reportErrors: true };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  ai.getSentenceFeedback.mockReset().mockResolvedValue(FEEDBACK);
  speech.speakAsync.mockReset().mockResolvedValue(undefined);
  speech.stopSpeaking.mockReset();
  log.error.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

// ---------------------------------------------------------------- fixtures

function makeWord(overrides: Partial<HomeworkWord> & Pick<HomeworkWord, "word">): HomeworkWord {
  return {
    key: overrides.word,
    vocabularyId: `vocab-${overrides.word}`,
    definitions: [{ partOfSpeech: "noun", definition: "a thing." }],
    sentence: null,
    cloze: null,
    cefr: { level: "A1", source: "list" },
    ...overrides,
  };
}

const APPLE = makeWord({
  word: "apple",
  emoji: "🍎",
  definitions: [{ partOfSpeech: "noun", definition: "a round fruit with red or green skin" }],
  sentence: "I ate an apple.",
});
const RUN = makeWord({
  word: "run",
  definitions: [{ partOfSpeech: "verb", definition: "to move fast on foot" }],
  sentence: "She ran to the park.",
});
// No example sentence, as when the sentence request failed.
const KITE = makeWord({
  word: "kite",
  definitions: [{ partOfSpeech: "noun", definition: "a toy that flies on a string" }],
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** A homework whose progress is frozen, so a step that mutates it throws. */
function makeHomework(
  words: HomeworkWord[],
  edit: (progress: HomeworkWordProgress[]) => void = () => {},
): Homework {
  const progress = emptyProgress(words.length);
  edit(progress);
  return deepFreeze({
    id: "hw",
    status: "active",
    createdAt: 0,
    options: { wordCount: words.length, startLevel: "A1" },
    words,
    progress,
  });
}

const FEEDBACK: SentenceFeedback = {
  usedCorrectly: true,
  feedback: "Great sentence! You used the word well.",
  suggestion: "I ate a red apple for lunch.",
};

// ----------------------------------------------------------------- helpers

interface Mounted {
  onProgress: Mock<(next: HomeworkWordProgress[]) => void>;
  onExit: Mock<() => void>;
  /** Changes the progress from outside the step, as another part of the app might. */
  patchProgress: (edit: (progress: HomeworkWordProgress[]) => HomeworkWordProgress[]) => void;
  /** The progress the step last reported, or the starting progress. */
  progress: () => HomeworkWordProgress[];
}

/**
 * Renders a step the way the page does: each reported progress array replaces
 * the homework's progress, so the step re-renders with its own answers.
 */
function mountStep<Extra extends object = object>(
  Step: ComponentType<StepProps & Extra>,
  initial: Homework,
  extra?: Extra,
): Mounted {
  let latest = initial.progress;
  let setProgressFromOutside: (next: HomeworkWordProgress[]) => void = () => {};
  const onProgress = vi.fn((next: HomeworkWordProgress[]) => {
    // The page hands over the complete next array, never an edited copy of the old one.
    expect(next).not.toBe(latest);
    expect(next).toHaveLength(initial.words.length);
    latest = next;
  });
  const onExit = vi.fn();

  function Harness() {
    const [progress, setProgress] = useState(initial.progress);
    useEffect(() => {
      setProgressFromOutside = setProgress;
    }, []);
    return (
      <Step
        {...(extra as Extra)}
        homework={{ ...initial, progress }}
        onProgress={(next) => {
          onProgress(next);
          setProgress(next);
        }}
        onExit={onExit}
      />
    );
  }
  act(() => root.render(<Harness />));
  return {
    onProgress,
    onExit,
    patchProgress: (edit) => {
      latest = deepFreeze(edit(latest));
      act(() => setProgressFromOutside(latest));
    },
    progress: () => latest,
  };
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`No button containing "${text}"`);
  return found;
}

function maybeButton(text: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
}

function click(target: HTMLElement) {
  act(() => target.click());
}

function text(): string {
  return host.textContent ?? "";
}

function status(): string {
  return host.querySelector('[role="status"]')?.textContent ?? "";
}

/** Lets resolved promises settle and React re-render. */
async function flush() {
  await act(async () => {});
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

// ------------------------------------------------------------ SentenceStep

function textarea(): HTMLTextAreaElement {
  const found = host.querySelector("textarea");
  if (!found) throw new Error("No textarea");
  return found;
}

function typeSentence(value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(textarea(), value);
    textarea().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(init: KeyboardEventInit = {}) {
  act(() => {
    textarea().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init }),
    );
  });
}

/** Types a sentence and submits it with Enter. */
function writeSentence(value: string) {
  typeSentence(value);
  pressEnter();
}

describe("SentenceStep", () => {
  it("asks for the word and does nothing else when the sentence does not use it", () => {
    const mounted = mountStep(SentenceStep, makeHomework([APPLE, RUN]));

    writeSentence("I like bananas.");

    expect(status()).toBe("Try using the word apple in your sentence.");
    expect(ai.getSentenceFeedback).not.toHaveBeenCalled();
    expect(mounted.onProgress).not.toHaveBeenCalled();
  });

  it("accepts a changed form of the word", () => {
    const mounted = mountStep(SentenceStep, makeHomework([RUN, APPLE]));

    writeSentence("They are running home.");

    expect(status()).not.toContain("Try using");
    expect(mounted.progress()[0].sentence).toEqual({ text: "They are running home.", feedback: null });
  });

  it("saves the sentence right away, then the feedback, and shows both", async () => {
    const pending = deferred<SentenceFeedback>();
    ai.getSentenceFeedback.mockReturnValue(pending.promise);
    const mounted = mountStep(SentenceStep, makeHomework([APPLE, RUN]));

    writeSentence("  I ate an apple at home.  ");

    expect(mounted.onProgress).toHaveBeenCalledTimes(1);
    expect(mounted.progress()[0].sentence).toEqual({
      text: "I ate an apple at home.",
      feedback: null,
    });
    expect(mounted.progress()[1].sentence).toBeNull();
    expect(ai.getSentenceFeedback).toHaveBeenCalledWith(
      "apple",
      "I ate an apple at home.",
      expect.any(AbortSignal),
    );
    expect(status()).toBe("Checking your sentence…");

    await act(async () => pending.resolve(FEEDBACK));

    expect(mounted.onProgress).toHaveBeenCalledTimes(2);
    expect(mounted.progress()[0].sentence).toEqual({
      text: "I ate an apple at home.",
      feedback: FEEDBACK,
    });
    expect(status()).toBe("");
    expect(text()).toContain(FEEDBACK.feedback);
    expect(text()).toContain("Another way to say it:");
    expect(text()).toContain(FEEDBACK.suggestion);
  });

  it("shows the feedback without a suggestion when there is none", async () => {
    ai.getSentenceFeedback.mockResolvedValue({ usedCorrectly: true, feedback: "Nice work!" });
    mountStep(SentenceStep, makeHomework([APPLE]));

    writeSentence("I ate an apple.");
    await flush();

    expect(text()).toContain("Nice work!");
    expect(text()).not.toContain("Another way to say it:");
  });

  it("keeps the sentence and offers a retry when the feedback fails", async () => {
    ai.getSentenceFeedback.mockRejectedValueOnce(new Error("quota used up"));
    const mounted = mountStep(SentenceStep, makeHomework([APPLE, RUN]));

    writeSentence("I ate an apple.");
    await flush();

    expect(status()).toBe("Feedback isn’t available right now.");
    expect(mounted.progress()[0].sentence).toEqual({ text: "I ate an apple.", feedback: null });
    expect(mounted.onProgress).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);

    ai.getSentenceFeedback.mockResolvedValueOnce(FEEDBACK);
    click(button("Try again"));
    await flush();

    expect(ai.getSentenceFeedback).toHaveBeenCalledTimes(2);
    expect(ai.getSentenceFeedback).toHaveBeenLastCalledWith(
      "apple",
      "I ate an apple.",
      expect.any(AbortSignal),
    );
    expect(mounted.progress()[0].sentence).toEqual({ text: "I ate an apple.", feedback: FEEDBACK });
    expect(maybeButton("Try again")).toBeUndefined();
    expect(text()).toContain(FEEDBACK.feedback);
  });

  it("shows the retry while the retry itself is waiting, and again if it fails", async () => {
    ai.getSentenceFeedback.mockRejectedValueOnce(new Error("first"));
    mountStep(SentenceStep, makeHomework([APPLE]));
    writeSentence("I ate an apple.");
    await flush();

    const second = deferred<SentenceFeedback>();
    ai.getSentenceFeedback.mockReturnValueOnce(second.promise);
    click(button("Try again"));
    expect(status()).toBe("Checking your sentence…");
    expect(maybeButton("Try again")).toBeUndefined();

    await act(async () => second.reject(new Error("second")));

    expect(status()).toBe("Feedback isn’t available right now.");
    expect(maybeButton("Try again")).toBeDefined();
  });

  it("replaces the earlier sentence and feedback when a changed sentence is sent", async () => {
    ai.getSentenceFeedback.mockResolvedValueOnce(FEEDBACK);
    const mounted = mountStep(SentenceStep, makeHomework([APPLE]));
    writeSentence("I ate an apple.");
    await flush();
    expect(text()).toContain(FEEDBACK.feedback);

    const second = deferred<SentenceFeedback>();
    ai.getSentenceFeedback.mockReturnValueOnce(second.promise);
    expect(textarea().value).toBe("I ate an apple.");
    writeSentence("The apple is sweet.");

    expect(mounted.progress()[0].sentence).toEqual({ text: "The apple is sweet.", feedback: null });
    expect(text()).not.toContain(FEEDBACK.feedback);

    const newer: SentenceFeedback = { usedCorrectly: true, feedback: "Even better!" };
    await act(async () => second.resolve(newer));

    expect(mounted.progress()[0].sentence).toEqual({ text: "The apple is sweet.", feedback: newer });
    expect(text()).toContain("Even better!");
    expect(text()).not.toContain(FEEDBACK.feedback);
    expect(ai.getSentenceFeedback).toHaveBeenCalledTimes(2);
  });

  it("ignores the answer to a request that a newer sentence replaced", async () => {
    const first = deferred<SentenceFeedback>();
    const second = deferred<SentenceFeedback>();
    ai.getSentenceFeedback
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const mounted = mountStep(SentenceStep, makeHomework([APPLE]));

    writeSentence("I ate an apple.");
    const firstSignal = ai.getSentenceFeedback.mock.calls[0][2] as AbortSignal;
    writeSentence("The apple is sweet.");
    expect(firstSignal.aborted).toBe(true);

    await act(async () => first.resolve({ usedCorrectly: true, feedback: "Old news." }));
    expect(text()).not.toContain("Old news.");
    expect(status()).toBe("Checking your sentence…");

    await act(async () => second.resolve({ usedCorrectly: true, feedback: "Fresh news." }));
    expect(mounted.progress()[0].sentence?.feedback?.feedback).toBe("Fresh news.");
  });

  it("builds the saved feedback on the latest progress, so other answers survive", async () => {
    const pending = deferred<SentenceFeedback>();
    ai.getSentenceFeedback.mockReturnValue(pending.promise);
    const mounted = mountStep(SentenceStep, makeHomework([APPLE, RUN]));

    writeSentence("I ate an apple.");
    mounted.patchProgress((progress) =>
      progress.map((entry, i) => (i === 1 ? { ...entry, learned: true, spellCorrect: 3 } : entry)),
    );
    await act(async () => pending.resolve(FEEDBACK));

    const saved = mounted.progress();
    expect(saved[0].sentence).toEqual({ text: "I ate an apple.", feedback: FEEDBACK });
    expect(saved[1].learned).toBe(true);
    expect(saved[1].spellCorrect).toBe(3);
  });

  it("cancels the request without a word when the learner moves to another word", async () => {
    const pending = deferred<SentenceFeedback>();
    ai.getSentenceFeedback.mockReturnValue(pending.promise);
    const mounted = mountStep(SentenceStep, makeHomework([APPLE, RUN]));
    writeSentence("I ate an apple.");
    const signal = ai.getSentenceFeedback.mock.calls[0][2] as AbortSignal;

    click(button("Next"));
    expect(signal.aborted).toBe(true);
    expect(status()).toBe("");

    await act(async () => pending.reject(abortError()));
    expect(mounted.onProgress).toHaveBeenCalledTimes(1);
    expect(log.error).not.toHaveBeenCalled();
    expect(text()).not.toContain("Feedback isn’t available right now.");

    // Back on the first word the sentence is there; only its feedback is missing.
    click(button("Previous"));
    expect(textarea().value).toBe("I ate an apple.");
    expect(status()).toBe("Feedback isn’t available right now.");
    expect(button("Try again")).toBeDefined();
  });

  it("cancels the request when the step is left", async () => {
    const pending = deferred<SentenceFeedback>();
    ai.getSentenceFeedback.mockReturnValue(pending.promise);
    const mounted = mountStep(SentenceStep, makeHomework([APPLE]));
    writeSentence("I ate an apple.");
    const signal = ai.getSentenceFeedback.mock.calls[0][2] as AbortSignal;

    act(() => root.render(null));
    expect(signal.aborted).toBe(true);

    await act(async () => pending.reject(abortError()));
    expect(mounted.onProgress).toHaveBeenCalledTimes(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it("starts at the first word without a usable sentence and counts the position", () => {
    mountStep(
      SentenceStep,
      makeHomework([APPLE, RUN, KITE], (progress) => {
        progress[0].sentence = { text: "I ate an apple.", feedback: null };
        // This one does not use its word, so it does not count.
        progress[1].sentence = { text: "She went home.", feedback: null };
      }),
    );

    expect(text()).toContain("Word 2 of 3");
    expect(text()).toContain("run");
    expect(textarea().value).toBe("She went home.");
  });

  it("shows the finish screen when every word has a sentence, and can review them", () => {
    const mounted = mountStep(
      SentenceStep,
      makeHomework([APPLE, RUN], (progress) => {
        progress[0].sentence = { text: "I ate an apple.", feedback: null };
        progress[1].sentence = { text: "I run home.", feedback: null };
      }),
    );

    expect(text()).toContain("Well done!");
    expect(textarea).toThrow();

    click(button("Review my sentences"));
    expect(text()).toContain("Word 1 of 2");
    expect(textarea().value).toBe("I ate an apple.");

    click(button("Back to overview"));
    expect(mounted.onExit).toHaveBeenCalledTimes(1);
  });

  it("moves between words with Next and Previous, and finishes after the last sentence", () => {
    mountStep(SentenceStep, makeHomework([APPLE, RUN]));
    expect(button("Previous").disabled).toBe(true);

    click(button("Next"));
    expect(text()).toContain("Word 2 of 2");
    expect(button("Previous").disabled).toBe(false);

    click(button("Previous"));
    expect(text()).toContain("Word 1 of 2");
    writeSentence("I ate an apple.");
    click(button("Next"));
    writeSentence("I run fast.");
    expect(text()).toContain("Word 2 of 2");
    click(button("Next"));

    expect(text()).toContain("Well done!");
  });

  it("will not leave the last word for the finish screen while it has no sentence", () => {
    mountStep(
      SentenceStep,
      makeHomework([APPLE, RUN], (progress) => {
        progress[0].sentence = { text: "I ate an apple.", feedback: null };
      }),
    );

    expect(text()).toContain("Word 2 of 2");
    expect(button("Next").disabled).toBe(true);

    writeSentence("I run fast.");
    expect(button("Next").disabled).toBe(false);
  });

  it("goes back to an earlier word that still has no sentence before it finishes", () => {
    mountStep(SentenceStep, makeHomework([APPLE, RUN, KITE]));

    click(button("Next"));
    click(button("Next"));
    writeSentence("My kite is red.");
    click(button("Next"));

    expect(text()).toContain("Word 1 of 3");
    writeSentence("I ate an apple.");
    click(button("Next"));
    expect(text()).toContain("Word 2 of 3");
    writeSentence("I run fast.");
    click(button("Next"));
    expect(text()).toContain("Word 3 of 3");
    click(button("Next"));
    expect(text()).toContain("Well done!");
  });

  it("is a labelled box with browser help switched off, and focuses it for each word", () => {
    mountStep(SentenceStep, makeHomework([APPLE, RUN]));

    const box = textarea();
    expect(box.labels?.[0]?.textContent).toBe("Write a sentence with this word");
    expect(box.getAttribute("spellcheck")).toBe("false");
    expect(box.getAttribute("autocomplete")).toBe("off");
    expect(box.getAttribute("autocorrect")).toBe("off");
    expect(box.getAttribute("autocapitalize")).toBe("off");
    expect(document.activeElement).toBe(box);

    click(button("Next"));
    expect(document.activeElement).toBe(textarea());
  });

  it("submits on Enter but not for Shift+Enter, a held Enter, or an empty box", () => {
    const mounted = mountStep(SentenceStep, makeHomework([APPLE]));

    pressEnter();
    typeSentence("   ");
    pressEnter();
    typeSentence("I ate an apple.");
    pressEnter({ shiftKey: true });
    pressEnter({ repeat: true });
    expect(mounted.onProgress).not.toHaveBeenCalled();

    pressEnter();
    expect(mounted.onProgress).toHaveBeenCalledTimes(1);
  });

  it("submits with the button, which waits for something to be typed", () => {
    const mounted = mountStep(SentenceStep, makeHomework([APPLE]));
    expect(button("Check my sentence").disabled).toBe(true);

    typeSentence("I ate an apple.");
    click(button("Check my sentence"));

    expect(mounted.onProgress).toHaveBeenCalledTimes(1);
  });

  it("shows the word and its English meaning, and no Chinese", () => {
    mountStep(SentenceStep, makeHomework([APPLE]));

    expect(text()).toContain("apple");
    expect(text()).toContain("a round fruit with red or green skin");
    expect(text()).not.toMatch(CHINESE);
  });
});

// -------------------------------------------------------- SpellingTestStep

interface TestMounted extends Mounted {
  onFinish: Mock<() => Promise<void>>;
}

function mountTest(initial: Homework, onFinish = vi.fn(() => Promise.resolve())): TestMounted {
  const mounted = mountStep(SpellingTestStep, initial, { onFinish });
  return { ...mounted, onFinish };
}

function answerInput(): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('input[type="text"]');
  if (!input) throw new Error("No text input");
  return input;
}

function typeAnswer(value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(answerInput(), value);
    answerInput().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Types an answer and submits it with Enter. */
function submitAnswer(value: string) {
  typeAnswer(value);
  act(() => {
    answerInput().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
  });
}

/** What the step asked the speech engine to say, in order. */
function spoken(): string[] {
  return speech.speakAsync.mock.calls.map(([spokenText]) => spokenText as string);
}

describe("SpellingTestStep", () => {
  it("says the word, then the sentence, then the word, each after the one before ends", async () => {
    const parts = [deferred(), deferred(), deferred()];
    parts.forEach((part) => speech.speakAsync.mockReturnValueOnce(part.promise));
    mountTest(makeHomework([APPLE, RUN]));

    expect(spoken()).toEqual(["apple"]);
    await act(async () => parts[0].resolve());
    expect(spoken()).toEqual(["apple", "I ate an apple."]);
    await act(async () => parts[1].resolve());
    expect(spoken()).toEqual(["apple", "I ate an apple.", "apple"]);
    await act(async () => parts[2].resolve());

    expect(spoken()).toHaveLength(3);
    speech.speakAsync.mock.calls.forEach((call) => expect(call[1]).toEqual(SPEAK_OPTIONS));
  });

  it("says the word twice when the word has no sentence", async () => {
    mountTest(makeHomework([KITE]));
    await flush();

    expect(spoken()).toEqual(["kite", "kite"]);
    speech.speakAsync.mock.calls.forEach((call) => expect(call[1]).toEqual(SPEAK_OPTIONS));
  });

  it("starts at the first word without an answer and counts the position", async () => {
    mountTest(
      makeHomework([APPLE, RUN, KITE], (progress) => {
        progress[0].testAnswer = "apple";
      }),
    );
    await flush();

    expect(text()).toContain("Word 2 of 3");
    expect(spoken()).toEqual(["run", "She ran to the park.", "run"]);
  });

  it("replays the same words with Hear it again", async () => {
    mountTest(makeHomework([APPLE, RUN]));
    await flush();
    expect(spoken()).toHaveLength(3);

    click(button("Hear it again"));
    await flush();

    expect(spoken()).toEqual([
      "apple",
      "I ate an apple.",
      "apple",
      "apple",
      "I ate an apple.",
      "apple",
    ]);
    expect(text()).toContain("Word 1 of 2");
  });

  it("starts over, rather than overlapping, when Hear it again is pressed mid-way", async () => {
    const first = deferred();
    speech.speakAsync.mockReturnValueOnce(first.promise);
    mountTest(makeHomework([APPLE]));
    expect(spoken()).toEqual(["apple"]);

    click(button("Hear it again"));
    expect(speech.stopSpeaking).toHaveBeenCalled();
    await flush();
    expect(spoken()).toEqual(["apple", "apple", "I ate an apple.", "apple"]);

    // The stopped sentence resolves late. It must not carry on with the old sequence.
    await act(async () => first.resolve());
    expect(spoken()).toHaveLength(4);
  });

  it("explains a playback failure, offers a retry and records no answer", async () => {
    speech.speakAsync.mockRejectedValueOnce(new Error("no voice"));
    const mounted = mountTest(makeHomework([APPLE, RUN]));
    await flush();

    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/audio didn.t play/i);
    expect(alert?.textContent).toMatch(/try again/i);
    expect(alert?.textContent).toContain("Settings");
    expect(alert?.textContent).not.toMatch(CHINESE);
    // The rest of the sequence is not played over a failure.
    expect(spoken()).toEqual(["apple"]);
    expect(mounted.onProgress).not.toHaveBeenCalled();
    expect(text()).toContain("Word 1 of 2");

    click(button("Try again"));
    await flush();

    expect(spoken()).toEqual(["apple", "apple", "I ate an apple.", "apple"]);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(mounted.onProgress).not.toHaveBeenCalled();
  });

  it("shows the playback failure again when the retry fails too", async () => {
    speech.speakAsync.mockRejectedValue(new Error("no voice"));
    mountTest(makeHomework([APPLE]));
    await flush();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    click(button("Try again"));
    await flush();

    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("clears the playback failure for the next word", async () => {
    speech.speakAsync.mockRejectedValueOnce(new Error("no voice"));
    mountTest(makeHomework([APPLE, RUN]));
    await flush();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    submitAnswer("apple");
    await flush();

    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(spoken().slice(1)).toEqual(["run", "She ran to the park.", "run"]);
  });

  it("keeps the box usable while the audio plays, and stops the audio on submit", async () => {
    speech.speakAsync.mockReturnValue(new Promise(() => {}));
    const mounted = mountTest(makeHomework([APPLE, RUN]));
    expect(spoken()).toEqual(["apple"]);

    expect(answerInput().disabled).toBe(false);
    expect(document.activeElement).toBe(answerInput());
    submitAnswer("aple");

    expect(mounted.progress()[0].testAnswer).toBe("aple");
    expect(speech.stopSpeaking).toHaveBeenCalled();
    expect(spoken()).toEqual(["apple", "run"]);
  });

  it("records the trimmed answer without saying whether it is right, then asks the next word", async () => {
    const mounted = mountTest(makeHomework([APPLE, RUN]));
    await flush();

    expect(answerInput().labels?.[0]?.textContent).toBe("Type the word you heard");
    submitAnswer("  aple  ");
    await flush();

    expect(mounted.onProgress).toHaveBeenCalledTimes(1);
    expect(mounted.progress()[0].testAnswer).toBe("aple");
    expect(mounted.progress()[1].testAnswer).toBeNull();
    expect(text()).toContain("Word 2 of 2");
    expect(answerInput().value).toBe("");
    expect(text()).not.toMatch(/correct|wrong|not quite|right/i);

    submitAnswer("run");
    await flush();
    expect(text()).not.toMatch(/correct|wrong|not quite|right/i);
  });

  it("does not record an empty answer", async () => {
    const mounted = mountTest(makeHomework([APPLE]));
    await flush();

    expect(button("Next").disabled).toBe(true);
    submitAnswer("   ");

    expect(mounted.onProgress).not.toHaveBeenCalled();
  });

  it("submits with the Next button", async () => {
    const mounted = mountTest(makeHomework([APPLE, RUN]));
    await flush();

    typeAnswer("apple");
    click(button("Next"));

    expect(mounted.progress()[0].testAnswer).toBe("apple");
  });

  it("offers Finish test after the last answer, and calls onFinish once for a double click", async () => {
    const finishing = deferred();
    const onFinish = vi.fn(() => finishing.promise);
    const mounted = mountTest(makeHomework([APPLE]), onFinish);
    await flush();

    submitAnswer("apple");
    await flush();
    expect(mounted.progress()[0].testAnswer).toBe("apple");
    expect(answerInput).toThrow();

    const finish = button("Finish test");
    expect(finish.disabled).toBe(false);
    act(() => {
      finish.click();
      finish.click();
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(button("Finish test").disabled).toBe(true);
    click(button("Finish test"));
    expect(onFinish).toHaveBeenCalledTimes(1);

    // The page shows the hook's error and the test stays open: the button works again.
    await act(async () => finishing.resolve());
    expect(button("Finish test").disabled).toBe(false);
    click(button("Finish test"));
    expect(onFinish).toHaveBeenCalledTimes(2);
  });

  it("goes straight to Finish test when every word already has an answer", async () => {
    const mounted = mountTest(
      makeHomework([APPLE, RUN], (progress) => {
        progress[0].testAnswer = "apple";
        progress[1].testAnswer = "run";
      }),
    );
    await flush();

    expect(button("Finish test").disabled).toBe(false);
    expect(speech.speakAsync).not.toHaveBeenCalled();
    expect(mounted.onProgress).not.toHaveBeenCalled();
  });

  it("leaves the test from a question or from the finish screen, but not while finishing", async () => {
    const finishing = deferred();
    const mounted = mountTest(makeHomework([APPLE]), vi.fn(() => finishing.promise));
    await flush();

    click(button("Back to overview"));
    expect(mounted.onExit).toHaveBeenCalledTimes(1);

    submitAnswer("apple");
    await flush();
    expect(maybeButton("Back to overview")).toBeDefined();

    click(button("Finish test"));
    expect(maybeButton("Back to overview")).toBeUndefined();

    await act(async () => finishing.resolve());
    expect(maybeButton("Back to overview")).toBeDefined();
  });

  it("stops the speech when it moves to the next word and when it is left", async () => {
    mountTest(makeHomework([APPLE, RUN]));
    await flush();
    speech.stopSpeaking.mockClear();

    submitAnswer("apple");
    await flush();
    expect(speech.stopSpeaking).toHaveBeenCalled();

    speech.stopSpeaking.mockClear();
    act(() => root.render(null));
    expect(speech.stopSpeaking).toHaveBeenCalled();
  });

  it("does not report a failure that happens after the learner moved on", async () => {
    const slow = deferred();
    speech.speakAsync.mockReturnValueOnce(slow.promise);
    mountTest(makeHomework([APPLE, RUN]));

    submitAnswer("apple");
    await flush();
    await act(async () => slow.reject(new Error("late")));

    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps the answer box free of browser help and never shows the sentence", async () => {
    mountTest(makeHomework([APPLE]));
    await flush();

    const input = answerInput();
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("off");
    expect(text()).not.toContain("apple");
    expect(text()).not.toContain("I ate");
    expect(text()).not.toMatch(CHINESE);
  });
});
