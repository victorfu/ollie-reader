import { act, useState, type ComponentProps, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Homework, HomeworkWord, HomeworkWordProgress } from "../../../types/wordPractice";
import { emptyProgress } from "../../../utils/homeworkProgress";
import { AnswerInput } from "../AnswerInput";
import { SpellingDiff } from "../SpellingDiff";
import type { StepProps } from "../stepTypes";
import { DefinitionStep } from "./DefinitionStep";
import { FillBlankStep } from "./FillBlankStep";
import { LearnStep } from "./LearnStep";
import { SpellStep } from "./SpellStep";

const speech = vi.hoisted(() => ({ speak: vi.fn() }));
vi.mock("../../../hooks/useSpeechState", () => ({
  useSpeechState: () => ({ speak: speech.speak }),
}));

const CHINESE = /[㐀-鿿]/;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  speech.speak.mockReset();
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
  cloze: { text: "I ate an _____.", answer: "apple" },
});
const RUN = makeWord({
  word: "run",
  definitions: [
    { partOfSpeech: "verb", definition: "to keep running" },
    { partOfSpeech: "noun", definition: "an act of going to run fast" },
  ],
  sentence: "She ran to the park.",
  cloze: { text: "She _____ to the park.", answer: "ran" },
});
// No example sentence, so no cloze either.
const KITE = makeWord({
  word: "kite",
  definitions: [{ partOfSpeech: "noun", definition: "a toy that flies on a string" }],
});

/** The word as it looks once its example sentence has been filled in. */
function withSentence(word: HomeworkWord, sentence: string, answer: string): HomeworkWord {
  return { ...word, sentence, cloze: { text: sentence.replace(answer, "_____"), answer } };
}

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

// ----------------------------------------------------------------- helpers

interface Mounted {
  onProgress: Mock<(next: HomeworkWordProgress[]) => void>;
  onExit: Mock<() => void>;
  /** Replaces the homework's words, as when missing example sentences get filled in. */
  setWords: (words: HomeworkWord[]) => void;
  /** The progress the step last reported, or the starting progress. */
  progress: () => HomeworkWordProgress[];
}

/**
 * Renders a step the way the page does: each reported progress array replaces
 * the homework's progress, so the step re-renders with its own answers.
 */
function mountStep(Step: ComponentType<StepProps>, initial: Homework): Mounted {
  let latest = initial.progress;
  const onProgress = vi.fn((next: HomeworkWordProgress[]) => {
    // The page hands over the complete next array, never an edited copy of the old one.
    expect(next).not.toBe(latest);
    expect(next).toHaveLength(initial.words.length);
    latest = next;
  });
  const onExit = vi.fn();

  function Harness({ words }: { words: HomeworkWord[] }) {
    const [progress, setProgress] = useState(initial.progress);
    return (
      <Step
        homework={{ ...initial, words, progress }}
        onProgress={(next) => {
          onProgress(next);
          setProgress(next);
        }}
        onExit={onExit}
      />
    );
  }
  const render = (words: HomeworkWord[]) => act(() => root.render(<Harness words={words} />));
  render(initial.words);
  return { onProgress, onExit, setWords: render, progress: () => latest };
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

function labelledButton(label: string): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`No button labelled "${label}"`);
  return found;
}

function click(target: HTMLElement) {
  act(() => target.click());
}

function textInput(): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('input[type="text"]');
  if (!input) throw new Error("No text input");
  return input;
}

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(target: HTMLElement, init: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init }),
    );
  });
}

/** Types an answer and submits it with Enter. */
function answer(value: string) {
  typeInto(textInput(), value);
  pressEnter(textInput());
}

function text(): string {
  return host.textContent ?? "";
}

function feedback(): string {
  return host.querySelector('[role="status"]')?.textContent ?? "";
}

// -------------------------------------------------------------- AnswerInput

describe("AnswerInput", () => {
  function renderInput(props: Partial<ComponentProps<typeof AnswerInput>> = {}, key = "a") {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    act(() =>
      root.render(
        <AnswerInput
          key={key}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          label="Type the word"
          {...props}
        />,
      ),
    );
    return { onChange, onSubmit };
  }

  it("is a labelled text input with browser help switched off", () => {
    renderInput();

    const input = textInput();
    expect(input.labels?.[0]?.textContent).toBe("Type the word");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("off");
  });

  it("takes focus when it mounts and again when its key changes", () => {
    renderInput({}, "first");
    expect(document.activeElement).toBe(textInput());

    act(() => textInput().blur());
    expect(document.activeElement).not.toBe(textInput());

    renderInput({}, "second");
    expect(document.activeElement).toBe(textInput());
  });

  it("reports typing and submits on Enter", () => {
    const { onChange, onSubmit } = renderInput({ value: "apple" });

    typeInto(textInput(), "apples");
    expect(onChange).toHaveBeenCalledWith("apples");

    pressEnter(textInput());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("ignores an empty or whitespace-only submit, other keys, held keys and IME confirmation", () => {
    const empty = renderInput({ value: "   " });
    pressEnter(textInput());
    expect(empty.onSubmit).not.toHaveBeenCalled();

    const typed = renderInput({ value: "apple" });
    act(() => {
      textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    pressEnter(textInput(), { repeat: true });
    pressEnter(textInput(), { isComposing: true });
    expect(typed.onSubmit).not.toHaveBeenCalled();
  });

  it("can be disabled", () => {
    renderInput({ disabled: true });
    expect(textInput().disabled).toBe(true);
  });
});

// ------------------------------------------------------------ SpellingDiff

describe("SpellingDiff", () => {
  function renderDiff(input: string, expected: string) {
    act(() => root.render(<SpellingDiff input={input} expected={expected} />));
    return host.firstElementChild as HTMLElement;
  }

  function partsOf(kind: string): string[] {
    return Array.from(host.querySelectorAll(`[data-kind="${kind}"]`)).map(
      (part) => part.textContent ?? "",
    );
  }

  it("names the correct spelling for assistive technology", () => {
    const diff = renderDiff("aple", "Apple");
    expect(diff.getAttribute("aria-label")).toBe("Correct spelling: Apple");
  });

  it("marks the letter that was left out", () => {
    renderDiff("aple", "apple");
    expect(text()).toBe("apple");
    expect(partsOf("missing")).toEqual(["p"]);
    expect(partsOf("wrong")).toEqual([]);
  });

  it("marks a wrong letter with the expected one and an extra letter with the typed one", () => {
    renderDiff("appla", "apple");
    expect(partsOf("wrong")).toEqual(["e"]);

    renderDiff("applee", "apple");
    expect(partsOf("extra")).toEqual(["e"]);
  });

  it("shows a missing space as a visible symbol", () => {
    renderDiff("icecream", "ice cream");
    expect(partsOf("missing")).toEqual(["␣"]);
    expect(text()).not.toContain(" ");
  });
});

// ---------------------------------------------------------------- LearnStep

describe("LearnStep", () => {
  it("shows the word, emoji, part of speech, English meaning and example sentence", () => {
    mountStep(LearnStep, makeHomework([APPLE, RUN]));

    expect(host.querySelector("h2")?.textContent).toBe("Learn");
    expect(text()).toContain("Word 1 of 2");
    expect(text()).toContain("apple");
    expect(text()).toContain("🍎");
    expect(text()).toContain("noun");
    expect(text()).toContain("a round fruit with red or green skin");
    expect(text()).toContain("I ate an apple.");
  });

  it("never shows Chinese, even if the word carries a Chinese definition", () => {
    const withChinese = { ...APPLE, definitionChinese: "蘋果" } as HomeworkWord;
    mountStep(LearnStep, makeHomework([withChinese, RUN]));
    expect(text()).not.toMatch(CHINESE);

    click(button("Next"));
    expect(text()).not.toMatch(CHINESE);
  });

  it("marks a card as learned when it is shown", () => {
    const { onProgress, progress } = mountStep(LearnStep, makeHomework([APPLE, RUN]));

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(progress().map((p) => p.learned)).toEqual([true, false]);

    click(button("Next"));
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(progress().map((p) => p.learned)).toEqual([true, true]);
  });

  it("does not report a card that was already learned", () => {
    const homework = makeHomework([APPLE, RUN], (progress) => {
      progress[0].learned = true;
      progress[1].learned = true;
    });
    const { onProgress } = mountStep(LearnStep, homework);

    // Everything is learned, so there is nothing left to show.
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("goes back and forward between cards without marking a learned card again", () => {
    const { onProgress } = mountStep(LearnStep, makeHomework([APPLE, RUN]));

    click(button("Next"));
    expect(text()).toContain("Word 2 of 2");
    expect(text()).toContain("to keep running");

    click(button("Previous"));
    expect(text()).toContain("Word 1 of 2");
    expect(text()).toContain("apple");
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it("has no Previous on the first card", () => {
    mountStep(LearnStep, makeHomework([APPLE, RUN]));
    expect(button("Previous").disabled).toBe(true);
  });

  it("plays the word and, when there is one, the sentence", () => {
    mountStep(LearnStep, makeHomework([APPLE, KITE]));

    click(labelledButton("Play pronunciation"));
    expect(speech.speak).toHaveBeenLastCalledWith("apple");
    click(labelledButton("Play sentence"));
    expect(speech.speak).toHaveBeenLastCalledWith("I ate an apple.");

    click(button("Next"));
    expect(text()).toContain("kite");
    expect(host.querySelector('button[aria-label="Play sentence"]')).toBeNull();
    click(labelledButton("Play pronunciation"));
    expect(speech.speak).toHaveBeenLastCalledWith("kite");
  });

  it("resumes at the first card that has not been learned", () => {
    const homework = makeHomework([APPLE, RUN, KITE], (progress) => {
      progress[0].learned = true;
    });
    mountStep(LearnStep, homework);

    expect(text()).toContain("Word 2 of 3");
    expect(text()).toContain("to keep running");
  });

  it("finishes after the last card and leaves for the overview", () => {
    const { onExit } = mountStep(LearnStep, makeHomework([APPLE, RUN]));
    click(button("Next"));

    click(button("Next"));

    expect(text()).toContain("You have looked at every word.");
    expect(text()).not.toContain("Word ");
    click(button("Back to overview"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("offers to go through the cards again after the last one, without changing progress", () => {
    const homework = makeHomework([APPLE, RUN], (progress) => {
      progress.forEach((entry) => (entry.learned = true));
    });
    const { onProgress } = mountStep(LearnStep, homework);
    expect(text()).toContain("You have looked at every word.");

    click(button("Review the cards"));

    expect(text()).toContain("Word 1 of 2");
    expect(text()).toContain("a round fruit with red or green skin");
    expect(onProgress).not.toHaveBeenCalled();

    click(button("Next"));
    click(button("Next"));
    expect(text()).toContain("You have looked at every word.");
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("draws no part-of-speech badge when a meaning has none", () => {
    const bare = makeWord({
      word: "kite",
      definitions: [{ partOfSpeech: "", definition: "a toy that flies on a string" }],
    });
    mountStep(LearnStep, makeHomework([bare]));

    expect(text()).toContain("a toy that flies on a string");
    expect(host.querySelector(".badge")).toBeNull();
  });

  it("goes straight to the finish when every card was already seen", () => {
    const homework = makeHomework([APPLE], (progress) => {
      progress[0].learned = true;
    });
    mountStep(LearnStep, homework);
    expect(text()).toContain("You have looked at every word.");
  });
});

// ---------------------------------------------------------------- SpellStep

describe("SpellStep", () => {
  /** One full round for a word: ready, then type `typed`, then submit. */
  function round(typed: string) {
    click(button("I’m ready"));
    answer(typed);
  }

  it("shows the word first and hides it once the learner is ready", () => {
    mountStep(SpellStep, makeHomework([APPLE, RUN]));

    expect(host.querySelector("h2")?.textContent).toBe("Spell It");
    expect(text()).toContain("Word 1 of 2");
    expect(text()).toContain("apple");
    click(labelledButton("Play pronunciation"));
    expect(speech.speak).toHaveBeenLastCalledWith("apple");

    click(button("I’m ready"));

    expect(text()).not.toContain("apple");
    // Nothing that is on the page, visible or not, gives the spelling away.
    expect(host.innerHTML).not.toMatch(/apple/i);
    const input = textInput();
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(document.activeElement).toBe(input);
    // The learner can still hear the word while it is hidden.
    click(labelledButton("Play pronunciation"));
    expect(speech.speak).toHaveBeenLastCalledWith("apple");
  });

  it("says the word once when it first comes up, not again on a later round or Look again", () => {
    mountStep(SpellStep, makeHomework([APPLE, RUN]));
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenLastCalledWith("apple");

    round("aple");
    click(button("Look again"));
    round("apple");
    expect(speech.speak).toHaveBeenCalledTimes(1);

    round("apple");
    round("apple");

    // Third correct spelling: on to the next word, which is said once as well.
    expect(text()).toContain("Word 2 of 2");
    expect(speech.speak).toHaveBeenCalledTimes(2);
    expect(speech.speak).toHaveBeenLastCalledWith("run");
  });

  it("says the word a returning learner resumes at", () => {
    const homework = makeHomework([APPLE, RUN], (progress) => {
      progress[0].spellCorrect = 3;
    });
    mountStep(SpellStep, homework);

    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenLastCalledWith("run");
  });

  it("does not say anything on the finish screen", () => {
    const homework = makeHomework([APPLE], (progress) => {
      progress[0].spellCorrect = 3;
    });
    mountStep(SpellStep, homework);

    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("counts a correct spelling, ignoring case and spaces around it", () => {
    const { progress, onProgress } = mountStep(SpellStep, makeHomework([APPLE, RUN]));

    round("Apple ");

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(progress().map((p) => p.spellCorrect)).toEqual([1, 0]);
    expect(feedback()).toContain("Correct!");
    expect(text()).toContain("1 of 3 correct");
    // Another look at the same word before the next round.
    expect(text()).toContain("apple");
    expect(maybeButton("I’m ready")).toBeDefined();
  });

  it("shows where a wrong spelling went wrong without changing the count", () => {
    const { progress, onProgress } = mountStep(SpellStep, makeHomework([APPLE, RUN]));

    round("aple");

    expect(onProgress).not.toHaveBeenCalled();
    expect(progress().map((p) => p.spellCorrect)).toEqual([0, 0]);
    const diff = host.querySelector('[role="img"]');
    expect(diff?.getAttribute("aria-label")).toBe("Correct spelling: apple");
    expect(diff?.querySelector('[data-kind="missing"]')?.textContent).toBe("p");
    expect(text()).toContain("The word is apple.");
    expect(host.querySelector('input[type="text"]')).toBeNull();
  });

  it("goes back to the word for another look after a wrong spelling", () => {
    const { progress } = mountStep(SpellStep, makeHomework([APPLE, RUN]));
    round("aple");

    click(button("Look again"));

    expect(text()).toContain("apple");
    expect(host.querySelector('[role="img"]')).toBeNull();
    expect(maybeButton("I’m ready")).toBeDefined();
    expect(progress().map((p) => p.spellCorrect)).toEqual([0, 0]);
  });

  it("keeps the correct word's capitalisation separate from the lower-cased diff", () => {
    const monday = makeWord({ word: "Monday" });
    mountStep(SpellStep, makeHomework([monday]));

    round("mondy");

    expect(text()).toContain("The word is Monday.");
  });

  it("moves to the next word after three correct spellings of the same word", () => {
    const { progress } = mountStep(SpellStep, makeHomework([APPLE, RUN]));

    round("apple");
    round("apple");
    expect(text()).toContain("Word 1 of 2");
    round("apple");

    expect(progress().map((p) => p.spellCorrect)).toEqual([3, 0]);
    expect(text()).toContain("Word 2 of 2");
    expect(text()).toContain("run");
    expect(text()).not.toContain("apple");
  });

  it("does not count past three, and wrong answers never take a point away", () => {
    const homework = makeHomework([APPLE, RUN], (progress) => {
      progress[0].spellCorrect = 2;
    });
    const { progress } = mountStep(SpellStep, homework);

    round("aple");
    click(button("Look again"));
    round("apple");

    expect(progress().map((p) => p.spellCorrect)).toEqual([3, 0]);
  });

  it("finishes once every word has three correct spellings", () => {
    const { onExit } = mountStep(SpellStep, makeHomework([APPLE]));

    for (let i = 0; i < 3; i++) round("apple");

    expect(text()).toContain("You spelled every word correctly three times.");
    click(button("Back to overview"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("resumes at the first word that is below three and skips finished words", () => {
    const homework = makeHomework([APPLE, RUN, KITE], (progress) => {
      progress[0].spellCorrect = 3;
      progress[1].spellCorrect = 1;
    });
    mountStep(SpellStep, homework);

    expect(text()).toContain("Word 2 of 3");
    expect(text()).toContain("run");
    expect(text()).toContain("1 of 3 correct");
  });

  it("ignores a submit with nothing typed", () => {
    const { onProgress } = mountStep(SpellStep, makeHomework([APPLE]));
    click(button("I’m ready"));

    pressEnter(textInput());
    typeInto(textInput(), "   ");
    pressEnter(textInput());

    expect(onProgress).not.toHaveBeenCalled();
    expect(host.querySelector('[role="img"]')).toBeNull();
  });
});

// ------------------------------------------------------------ FillBlankStep

describe("FillBlankStep", () => {
  it("shows the sentence with the blank and never the answer", () => {
    mountStep(FillBlankStep, makeHomework([RUN, APPLE]));

    expect(host.querySelector("h2")?.textContent).toBe("Fill in the Blank");
    expect(text()).toContain("Word 1 of 2");
    expect(text()).toContain("She _____ to the park.");
    expect(text()).not.toMatch(/\bran\b/);
    expect(text()).not.toMatch(/\brun\b/);
    // Neither the answer nor the word turns up anywhere in the markup either.
    expect(host.innerHTML).not.toMatch(/\bran\b/i);
    expect(host.innerHTML).not.toMatch(/\brun\b/i);
    expect(textInput().getAttribute("autocorrect")).toBe("off");
    expect(document.activeElement).toBe(textInput());
  });

  it("records a correct first try", () => {
    const { progress } = mountStep(FillBlankStep, makeHomework([RUN, APPLE]));

    answer(" RAN ");

    expect(progress()[0].fill).toEqual({ attempts: 1, correct: true, done: true });
    expect(feedback()).toContain("Correct!");
    expect(maybeButton("Next")).toBeDefined();
  });

  it("gives a second chance after a wrong answer without revealing the answer", () => {
    const { progress } = mountStep(FillBlankStep, makeHomework([RUN, APPLE]));

    answer("run");

    expect(progress()[0].fill).toEqual({ attempts: 1, correct: false, done: false });
    expect(feedback()).toBe("Not quite — try again.");
    expect(text()).not.toMatch(/\bran\b/);
    // The box is empty and ready for the second try.
    expect(textInput().value).toBe("");
    expect(document.activeElement).toBe(textInput());
    expect(maybeButton("Next")).toBeUndefined();

    answer("ran");

    expect(progress()[0].fill).toEqual({ attempts: 2, correct: true, done: true });
    expect(feedback()).toContain("Correct!");
  });

  it("focuses the empty box again after a wrong answer sent with the Check button", () => {
    mountStep(FillBlankStep, makeHomework([RUN, APPLE]));
    typeInto(textInput(), "run");
    const check = button("Check");
    act(() => check.focus());

    click(check);

    expect(textInput().value).toBe("");
    expect(document.activeElement).toBe(textInput());
  });

  it("reveals the answer after two wrong answers and records the miss", () => {
    const { progress } = mountStep(FillBlankStep, makeHomework([RUN, APPLE]));

    answer("run");
    answer("runned");

    expect(progress()[0].fill).toEqual({ attempts: 2, correct: false, done: true });
    expect(feedback()).toContain("The answer is ran.");
    expect(host.querySelector('input[type="text"]')).toBeNull();
  });

  it("goes to the next word, and finishes after the last one", () => {
    const { onExit } = mountStep(FillBlankStep, makeHomework([RUN, APPLE]));

    answer("ran");
    click(button("Next"));
    expect(text()).toContain("Word 2 of 2");
    expect(text()).toContain("I ate an _____.");
    expect(textInput().value).toBe("");
    expect(document.activeElement).toBe(textInput());

    answer("apple");
    click(button("Next"));

    expect(text()).toContain("All the blanks are filled in.");
    click(button("Back to overview"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("says so when a word has no sentence, and lets the learner move on", () => {
    const { onProgress } = mountStep(FillBlankStep, makeHomework([RUN, KITE, APPLE]));
    answer("ran");
    click(button("Next"));

    expect(text()).toContain("Word 2 of 3");
    expect(text()).toContain("No sentence for this word yet.");
    expect(host.querySelector('input[type="text"]')).toBeNull();

    click(button("Next"));
    expect(text()).toContain("Word 3 of 3");
    // Skipping a word records nothing for it.
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it("skips words without a sentence when resuming and when everything else is done", () => {
    const resumed = makeHomework([KITE, RUN, APPLE], (progress) => {
      progress[1].fill = { attempts: 1, correct: true, done: true };
    });
    mountStep(FillBlankStep, resumed);
    expect(text()).toContain("Word 3 of 3");
    expect(text()).toContain("I ate an _____.");
  });

  it("says there is no sentence, instead of finishing, when no word has one yet", () => {
    mountStep(FillBlankStep, makeHomework([KITE]));

    expect(text()).toContain("Word 1 of 1");
    expect(text()).toContain("No sentence for this word yet.");
    expect(text()).not.toContain("Well done");
    expect(host.querySelector('input[type="text"]')).toBeNull();
  });

  it("starts on the words without a sentence when every other word is done", () => {
    const homework = makeHomework([RUN, KITE], (progress) => {
      progress[0].fill = { attempts: 1, correct: true, done: true };
    });
    mountStep(FillBlankStep, homework);

    expect(text()).toContain("Word 2 of 2");
    expect(text()).toContain("No sentence for this word yet.");
  });

  it("finishes once the words without a sentence have been passed over", () => {
    mountStep(FillBlankStep, makeHomework([KITE]));
    click(button("Next"));
    expect(text()).toContain("All the blanks are filled in.");
  });

  it("starts the questions when sentences arrive after the step opened", () => {
    const ice = makeWord({ word: "ice" });
    const { setWords } = mountStep(FillBlankStep, makeHomework([KITE, ice]));
    expect(text()).toContain("No sentence for this word yet.");

    setWords([withSentence(KITE, "I fly a kite.", "kite"), withSentence(ice, "I like ice.", "ice")]);

    expect(text()).toContain("I fly a _____.");
    expect(text()).not.toContain("No sentence");
    expect(textInput().getAttribute("autocorrect")).toBe("off");
  });

  it("moves on to a later word whose sentence arrives while an earlier one still has none", () => {
    const ice = makeWord({ word: "ice" });
    const { setWords } = mountStep(FillBlankStep, makeHomework([KITE, ice]));

    setWords([KITE, withSentence(ice, "I like ice.", "ice")]);
    expect(text()).toContain("No sentence for this word yet.");
    click(button("Next"));

    expect(text()).toContain("Word 2 of 2");
    expect(text()).toContain("I like _____.");
  });

  it("starts the questions when sentences arrive after the learner passed over every word", () => {
    const { setWords } = mountStep(FillBlankStep, makeHomework([KITE]));
    click(button("Next"));
    expect(text()).toContain("All the blanks are filled in.");

    setWords([withSentence(KITE, "I fly a kite.", "kite")]);

    expect(text()).toContain("Word 1 of 1");
    expect(text()).toContain("I fly a _____.");
    expect(text()).not.toContain("Well done");
  });

  it("resumes a half-finished word on its second chance", () => {
    const homework = makeHomework([RUN], (progress) => {
      progress[0].fill = { attempts: 1, correct: false, done: false };
    });
    mountStep(FillBlankStep, homework);

    expect(feedback()).toBe("Not quite — try again.");
    expect(text()).toContain("She _____ to the park.");
  });

  it("finishes after the last word even when some words had no sentence", () => {
    mountStep(FillBlankStep, makeHomework([RUN, KITE]));
    answer("ran");
    click(button("Next"));
    click(button("Next"));
    expect(text()).toContain("All the blanks are filled in.");
  });

  it("comes back to a word that got its sentence after it was skipped", () => {
    const { setWords } = mountStep(FillBlankStep, makeHomework([KITE, RUN]));
    expect(text()).toContain("Word 2 of 2");
    answer("ran");

    setWords([{ ...KITE, sentence: "I fly a kite.", cloze: { text: "I fly a _____.", answer: "kite" } }, RUN]);
    click(button("Next"));

    expect(text()).toContain("Word 1 of 2");
    expect(text()).toContain("I fly a _____.");
  });

  it("asks about a word as soon as its sentence arrives", () => {
    const { setWords } = mountStep(FillBlankStep, makeHomework([RUN, KITE]));
    answer("ran");
    click(button("Next"));
    expect(text()).toContain("No sentence for this word yet.");

    setWords([RUN, { ...KITE, sentence: "I fly a kite.", cloze: { text: "I fly a _____.", answer: "kite" } }]);

    expect(text()).toContain("I fly a _____.");
    expect(text()).not.toContain("No sentence");
  });
});

// ----------------------------------------------------------- DefinitionStep

describe("DefinitionStep", () => {
  it("shows the part of speech and the meaning with the word hidden", () => {
    mountStep(DefinitionStep, makeHomework([RUN, APPLE]));

    expect(host.querySelector("h2")?.textContent).toBe("What's the Word?");
    expect(text()).toContain("Word 1 of 2");
    expect(text()).toContain("verb");
    expect(text()).toContain("to keep ____");
    expect(text()).not.toContain("running");
    expect(text()).not.toMatch(/\brun\b/i);
    expect(host.innerHTML).not.toMatch(/\brun(ning)?\b/i);
    expect(text()).not.toContain("🍎");
    expect(textInput().getAttribute("autocorrect")).toBe("off");
    expect(document.activeElement).toBe(textInput());
  });

  it("hides the word in every meaning when a word has several", () => {
    mountStep(DefinitionStep, makeHomework([RUN]));

    expect(text()).toContain("noun");
    expect(text()).toContain("an act of going to ____ fast");
    expect(text()).not.toMatch(/\brun\b/i);
  });

  it("draws no part-of-speech badge when a meaning has none", () => {
    const bare = makeWord({
      word: "kite",
      definitions: [{ partOfSpeech: "", definition: "a toy that flies on a string" }],
    });
    mountStep(DefinitionStep, makeHomework([bare]));

    expect(text()).toContain("a toy that flies on a string");
    expect(host.querySelector(".badge")).toBeNull();
  });

  it("never shows Chinese", () => {
    const withChinese = { ...RUN, definitionChinese: "跑" } as HomeworkWord;
    mountStep(DefinitionStep, makeHomework([withChinese]));
    expect(text()).not.toMatch(CHINESE);
  });

  it("records a correct first try", () => {
    const { progress } = mountStep(DefinitionStep, makeHomework([RUN, APPLE]));

    answer("Run");

    expect(progress()[0].define).toEqual({ attempts: 1, correct: true, done: true });
    expect(progress()[0].fill).toEqual({ attempts: 0, correct: false, done: false });
    expect(feedback()).toContain("Correct!");
  });

  it("gives two chances, then shows the word", () => {
    const { progress } = mountStep(DefinitionStep, makeHomework([RUN, APPLE]));

    answer("walk");
    expect(progress()[0].define).toEqual({ attempts: 1, correct: false, done: false });
    expect(feedback()).toBe("Not quite — try again.");
    expect(text()).not.toMatch(/\brun\b/i);

    answer("jog");
    expect(progress()[0].define).toEqual({ attempts: 2, correct: false, done: true });
    expect(feedback()).toContain("The answer is run.");
    expect(host.querySelector('input[type="text"]')).toBeNull();
  });

  it("moves on to the next word and then finishes", () => {
    const { onExit } = mountStep(DefinitionStep, makeHomework([RUN, APPLE]));

    answer("run");
    click(button("Next"));
    expect(text()).toContain("Word 2 of 2");
    expect(text()).toContain("a round fruit with red or green skin");

    answer("apple");
    click(button("Next"));

    expect(text()).toContain("You have named every word.");
    click(button("Back to overview"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("resumes at the first word that is not done", () => {
    const homework = makeHomework([RUN, APPLE], (progress) => {
      progress[0].define = { attempts: 2, correct: false, done: true };
    });
    mountStep(DefinitionStep, homework);

    expect(text()).toContain("Word 2 of 2");
    expect(text()).toContain("a round fruit with red or green skin");
  });
});

// --------------------------------------------------------- leaving mid-way

describe("leaving a step", () => {
  it.each([
    ["Learn", LearnStep],
    ["Spell It", SpellStep],
    ["Fill in the Blank", FillBlankStep],
    ["What's the Word?", DefinitionStep],
  ] as const)("%s can go back to the overview at any time", (_name, Step) => {
    const { onExit } = mountStep(Step, makeHomework([RUN, APPLE]));

    click(button("Back to overview"));

    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
