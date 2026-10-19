import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseWordPractice } from "../../hooks/useWordPractice";
import type { Homework, HomeworkWord } from "../../types/wordPractice";
import { emptyProgress } from "../../utils/homeworkProgress";

const hook = vi.hoisted(() => ({ current: null as unknown as UseWordPractice }));
vi.mock("../../hooks/useWordPractice", () => ({ useWordPractice: () => hook.current }));

import WordPracticePage from "./WordPracticePage";

const START_LEVEL_KEY = "ollie-word-practice-start-level";
const CEFR_J_CREDIT =
  "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.";
const OCTANOVE_CREDIT = "Octanove Vocabulary Profile (CC BY-SA 4.0)";
const STEP_NAMES = [
  "Learn",
  "Spell It",
  "Fill in the Blank",
  "What's the Word?",
  "Write a Sentence",
  "Spelling Test",
];

let host: HTMLDivElement;
let root: Root;

function makeWord(word: string): HomeworkWord {
  return {
    key: word,
    vocabularyId: `vocab-${word}`,
    word,
    definitions: [{ partOfSpeech: "noun", definition: `Meaning of ${word}.` }],
    sentence: `I like the ${word}.`,
    cloze: { text: `I like the ____.`, answer: word },
    cefr: { level: "A1", source: "list" },
  };
}

function makeHomework(overrides: Partial<Homework> = {}): Homework {
  const words = [makeWord("apple"), makeWord("banana")];
  return {
    id: "hw-active",
    status: "active",
    createdAt: new Date(2026, 9, 19, 12).getTime(),
    options: { wordCount: 2, startLevel: "A1" },
    words,
    progress: emptyProgress(words.length),
    ...overrides,
  };
}

/** A homework whose steps 1-5 are all complete, so the Spelling Test is unlocked. */
function makeUnlockedHomework(): Homework {
  const homework = makeHomework();
  return {
    ...homework,
    progress: homework.progress.map((progress, i) => ({
      ...progress,
      learned: true,
      spellCorrect: 3,
      fill: { attempts: 1, correct: true, done: true },
      define: { attempts: 1, correct: true, done: true },
      sentence: { text: `I like the ${homework.words[i].word}.`, feedback: null },
    })),
  };
}

function makeCompleted(): Homework {
  const homework = makeHomework({
    id: "hw-done",
    status: "completed",
    createdAt: new Date(2026, 9, 10, 12).getTime(),
    completedAt: new Date(2026, 9, 12, 12).getTime(),
  });
  return {
    ...homework,
    progress: homework.progress.map((progress, i) => ({
      ...progress,
      testAnswer: i === 0 ? "apple" : "banan",
    })),
    result: { correctKeys: ["apple"], missedKeys: ["banana"], correctCount: 1, total: 2 },
  };
}

function makeHook(overrides: Partial<UseWordPractice> = {}): UseWordPractice {
  return {
    status: "ready",
    error: null,
    active: null,
    history: [],
    generating: false,
    saveError: null,
    generate: vi.fn().mockResolvedValue("created"),
    abandon: vi.fn().mockResolvedValue(undefined),
    updateProgress: vi.fn(),
    ensureSentences: vi.fn().mockResolvedValue(undefined),
    finishTest: vi.fn().mockResolvedValue(null),
    reload: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function render() {
  act(() => root.render(<WordPracticePage />));
}

function getButton(text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`No button containing "${text}"`);
  return button;
}

function getSelect(labelText: string): HTMLSelectElement {
  const label = Array.from(host.querySelectorAll("label")).find((candidate) =>
    candidate.textContent?.includes(labelText),
  );
  const select = label && document.getElementById(label.htmlFor);
  if (!(select instanceof HTMLSelectElement)) throw new Error(`No select labelled "${labelText}"`);
  return select;
}

function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** The text of every live region that currently has something to announce. */
function statusMessages(): string[] {
  return Array.from(host.querySelectorAll('[role="status"]'))
    .map((region) => region.textContent ?? "")
    .filter((text) => text !== "");
}

function openDialog(): HTMLDialogElement | null {
  return host.querySelector<HTMLDialogElement>("dialog[open]");
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  // jsdom does not implement the modal dialog methods ConfirmModal calls.
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  window.localStorage.clear();
  hook.current = makeHook();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("generate panel", () => {
  it("offers 5-20 words (default 10), levels A1-C2 (default A1) and the generate button", () => {
    render();

    const wordCount = getSelect("單字數量");
    expect(wordCount.value).toBe("10");
    expect(Array.from(wordCount.options).map((option) => option.value)).toEqual(
      Array.from({ length: 16 }, (_, i) => String(i + 5)),
    );

    const startLevel = getSelect("起始等級");
    expect(startLevel.value).toBe("A1");
    expect(Array.from(startLevel.options).map((option) => option.value)).toEqual([
      "A1",
      "A2",
      "B1",
      "B2",
      "C1",
      "C2",
    ]);

    expect(getButton("產生功課").disabled).toBe(false);
  });

  it("keeps the chosen start level after the page is mounted again", () => {
    render();
    choose(getSelect("起始等級"), "B1");
    expect(window.localStorage.getItem(START_LEVEL_KEY)).toBe("B1");

    act(() => root.render(null));
    render();

    expect(getSelect("起始等級").value).toBe("B1");
  });

  it("falls back to A1 when the stored level is not a level", () => {
    window.localStorage.setItem(START_LEVEL_KEY, "Z9");
    render();
    expect(getSelect("起始等級").value).toBe("A1");
  });

  it("falls back to A1 when localStorage throws, and still lets the level change", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    render();
    expect(getSelect("起始等級").value).toBe("A1");

    choose(getSelect("起始等級"), "C1");

    expect(getSelect("起始等級").value).toBe("C1");
  });

  it("generates with the chosen options straight away when nothing is in progress", async () => {
    render();
    choose(getSelect("單字數量"), "7");
    choose(getSelect("起始等級"), "B2");

    await act(async () => getButton("產生功課").click());

    expect(hook.current.generate).toHaveBeenCalledWith({ wordCount: 7, startLevel: "B2" });
    expect(openDialog()).toBeNull();
  });

  it("asks before replacing the homework in progress and generates only after confirming", async () => {
    hook.current = makeHook({ active: makeHomework() });
    render();

    act(() => getButton("產生功課").click());

    expect(openDialog()?.textContent).toContain("要放棄目前的功課嗎？");
    expect(hook.current.generate).not.toHaveBeenCalled();

    await act(async () => {
      Array.from(openDialog()!.querySelectorAll("button"))
        .find((button) => button.textContent === "放棄並產生")!
        .click();
    });

    expect(hook.current.generate).toHaveBeenCalledWith({ wordCount: 10, startLevel: "A1" });
    expect(openDialog()).toBeNull();
  });

  it("does not generate when the replacement is cancelled", () => {
    hook.current = makeHook({ active: makeHomework() });
    render();

    act(() => getButton("產生功課").click());
    act(() => {
      Array.from(openDialog()!.querySelectorAll("button"))
        .find((button) => button.textContent === "取消")!
        .click();
    });

    expect(hook.current.generate).not.toHaveBeenCalled();
    expect(openDialog()).toBeNull();
  });

  it("says so when the vocabulary book has no new words to practice", async () => {
    hook.current = makeHook({ generate: vi.fn().mockResolvedValue("empty") });
    render();

    await act(async () => getButton("產生功課").click());

    expect(host.textContent).toContain("生詞本裡沒有可以練習的新單字");
  });

  it("clears the empty notice when the next generate succeeds", async () => {
    const generate = vi.fn().mockResolvedValueOnce("empty").mockResolvedValueOnce("created");
    hook.current = makeHook({ generate });
    render();

    await act(async () => getButton("產生功課").click());
    expect(host.textContent).toContain("生詞本裡沒有可以練習的新單字");
    await act(async () => getButton("產生功課").click());

    expect(host.textContent).not.toContain("生詞本裡沒有可以練習的新單字");
  });

  it("disables the button and announces the wait while generating", () => {
    hook.current = makeHook({ generating: true });
    render();

    expect(getButton("產生功課").disabled).toBe(true);
    expect(statusMessages()).toEqual(["正在產生功課…"]);
  });

  it("shows no waiting message when it is not generating", () => {
    render();
    expect(statusMessages()).toEqual([]);
  });

  it("keeps the live region mounted so that the waiting message is announced", () => {
    render();
    const region = host.querySelector('[role="status"]');
    expect(region).not.toBeNull();

    hook.current = makeHook({ generating: true });
    render();

    expect(host.querySelector('[role="status"]')).toBe(region);
    expect(region?.textContent).toContain("正在產生功課…");
  });

  it("keeps the empty notice when the page moved to another view while generating", async () => {
    let finishGenerating: (outcome: "empty") => void = () => {};
    const generate = vi.fn(
      () =>
        new Promise<"empty">((resolve) => {
          finishGenerating = resolve;
        }),
    );
    hook.current = makeHook({ history: [makeCompleted()], generate });
    render();
    act(() => getButton("產生功課").click());
    act(() => getButton("1 / 2").click());
    expect(host.textContent).toContain("拼字考試成績");

    await act(async () => finishGenerating("empty"));

    expect(statusMessages()).toEqual(["生詞本裡沒有可以練習的新單字"]);
    expect(host.textContent).toContain("拼字考試成績");
  });
});

describe("overview", () => {
  it("lists the six steps in order with their completion", () => {
    const homework = makeHomework();
    homework.progress = homework.progress.map((progress) => ({ ...progress, learned: true }));
    hook.current = makeHook({ active: homework });
    render();

    const items = Array.from(host.querySelectorAll("ol > li"));
    expect(items).toHaveLength(6);
    STEP_NAMES.forEach((name, i) => expect(items[i].textContent).toContain(name));
    expect(items[0].textContent).toContain("已完成");
    expect(items[1].textContent).toContain("未完成");
    expect(items[5].textContent).toContain("未完成");
  });

  it("keeps the Spelling Test closed until steps 1-5 are all complete", () => {
    const homework = makeHomework();
    homework.progress = homework.progress.map((progress) => ({ ...progress, learned: true }));
    hook.current = makeHook({ active: homework });
    render();

    expect(getButton("Spelling Test").disabled).toBe(true);
    expect(getButton("Learn").disabled).toBe(false);
  });

  it("opens the Spelling Test once steps 1-5 are complete", () => {
    hook.current = makeHook({ active: makeUnlockedHomework() });
    render();

    expect(getButton("Spelling Test").disabled).toBe(false);
  });

  it("opens a step and comes back to the overview", () => {
    hook.current = makeHook({ active: makeHomework() });
    render();

    act(() => getButton("Fill in the Blank").click());
    expect(host.querySelector("h2")?.textContent).toBe("Fill in the Blank");
    expect(host.querySelector("ol")).toBeNull();

    act(() => getButton("回到總覽").click());
    expect(host.querySelectorAll("ol > li")).toHaveLength(6);
  });

  it("continues with the first step that is not complete", () => {
    const homework = makeHomework();
    homework.progress = homework.progress.map((progress) => ({ ...progress, learned: true }));
    hook.current = makeHook({ active: homework });
    render();

    act(() => getButton("繼續").click());

    expect(host.querySelector("h2")?.textContent).toBe("Spell It");
  });

  it("asks before abandoning and abandons only after confirming", async () => {
    hook.current = makeHook({ active: makeHomework() });
    render();

    act(() => getButton("放棄這份功課").click());
    expect(openDialog()).not.toBeNull();
    expect(hook.current.abandon).not.toHaveBeenCalled();

    act(() => {
      Array.from(openDialog()!.querySelectorAll("button"))
        .find((button) => button.textContent === "取消")!
        .click();
    });
    expect(hook.current.abandon).not.toHaveBeenCalled();

    act(() => getButton("放棄這份功課").click());
    await act(async () => {
      Array.from(openDialog()!.querySelectorAll("button"))
        .find((button) => button.textContent === "放棄功課")!
        .click();
    });

    expect(hook.current.abandon).toHaveBeenCalledTimes(1);
    expect(openDialog()).toBeNull();
  });

  it("is read-only while a replacement homework is generating", () => {
    hook.current = makeHook({ active: makeHomework(), generating: true });
    render();

    const stepButtons = Array.from(host.querySelectorAll("ol button"));
    expect(stepButtons).toHaveLength(6);
    stepButtons.forEach((button) => expect((button as HTMLButtonElement).disabled).toBe(true));
    expect(getButton("繼續").disabled).toBe(true);
    expect(getButton("放棄這份功課").disabled).toBe(true);
  });

  it("goes back to the overview when a different homework becomes active", () => {
    hook.current = makeHook({ active: makeHomework() });
    render();
    act(() => getButton("Fill in the Blank").click());
    expect(host.querySelector("ol")).toBeNull();

    hook.current = makeHook({ active: makeHomework({ id: "hw-replacement" }) });
    render();

    expect(host.querySelectorAll("ol > li")).toHaveLength(6);
  });

  it("stays on the step when the same homework gets new progress", () => {
    const homework = makeHomework();
    hook.current = makeHook({ active: homework });
    render();
    act(() => getButton("Fill in the Blank").click());

    hook.current = makeHook({
      active: {
        ...homework,
        progress: homework.progress.map((progress) => ({ ...progress, learned: true })),
      },
    });
    render();

    expect(host.querySelector("h2")?.textContent).toBe("Fill in the Blank");
  });

  it("is not shown when no homework is in progress", () => {
    render();
    expect(host.querySelector("ol")).toBeNull();
    expect(host.textContent).not.toContain("放棄這份功課");
  });
});

describe("history and result", () => {
  it("lists past homework with its date and score", () => {
    hook.current = makeHook({ history: [makeCompleted()] });
    render();

    const entry = getButton("1 / 2");
    expect(entry.textContent).toContain("2026/10/12");
  });

  it("names each history entry with its date and score", () => {
    hook.current = makeHook({ history: [makeCompleted()] });
    render();

    expect(getButton("1 / 2").getAttribute("aria-label")).toBe("2026/10/12，答對 1 / 2");
  });

  it("says so when there is no past homework", () => {
    render();
    expect(host.textContent).toContain("還沒有完成的功課");
  });

  it("opens the result with each answer next to the correct spelling and marks the wrong one", () => {
    hook.current = makeHook({ history: [makeCompleted()] });
    render();

    act(() => getButton("1 / 2").click());

    const rows = Array.from(host.querySelectorAll("li"));
    const apple = rows.find((row) => row.textContent?.includes("apple"))!;
    const banana = rows.find((row) => row.textContent?.includes("banana"))!;
    expect(apple.textContent).toContain("答對");
    expect(apple.textContent).not.toContain("答錯");
    expect(banana.textContent).toContain("答錯");
    expect(banana.textContent).toContain("banan");
    expect(banana.textContent).toContain("banana");
    expect(host.textContent).toContain("1 / 2");
  });

  it("marks a word as correct only when the result lists it as correct", () => {
    const completed = makeCompleted();
    completed.result = { correctKeys: [], missedKeys: [], correctCount: 0, total: 2 };
    hook.current = makeHook({ history: [completed] });
    render();

    act(() => getButton("0 / 2").click());

    const rows = Array.from(host.querySelectorAll("li"));
    expect(rows.every((row) => row.textContent?.includes("答錯"))).toBe(true);
  });

  it("shows an unanswered word as such", () => {
    const completed = makeCompleted();
    completed.progress[1] = { ...completed.progress[1], testAnswer: null };
    hook.current = makeHook({ history: [completed] });
    render();

    act(() => getButton("1 / 2").click());

    expect(host.textContent).toContain("未作答");
  });

  it("goes back from the result to the home view", () => {
    hook.current = makeHook({ history: [makeCompleted()] });
    render();
    act(() => getButton("1 / 2").click());

    act(() => getButton("返回").click());

    expect(getButton("產生功課")).toBeDefined();
    expect(getButton("1 / 2")).toBeDefined();
  });
});

describe("page states", () => {
  it("shows a loading state without the generate panel while loading", () => {
    hook.current = makeHook({ status: "loading" });
    render();

    expect(statusMessages()).toEqual(["載入中…"]);
    expect(host.textContent).not.toContain("產生功課");
  });

  it("shows a failed load with a reload button that calls reload", () => {
    hook.current = makeHook({ status: "error", error: "載入單字練習失敗，請稍後再試" });
    render();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("載入單字練習失敗");
    expect(host.textContent).not.toContain("產生功課");
    act(() => getButton("重新載入").click());
    expect(hook.current.reload).toHaveBeenCalledTimes(1);
  });

  it("shows an operation error as an alert without a reload button", () => {
    hook.current = makeHook({ error: "產生功課失敗，請稍後再試" });
    render();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("產生功課失敗");
    expect(Array.from(host.querySelectorAll("button")).some((b) => b.textContent === "重新載入")).toBe(
      false,
    );
    expect(getButton("產生功課").disabled).toBe(false);
  });

  it("shows a save error without blocking the page", () => {
    hook.current = makeHook({
      active: makeHomework(),
      saveError: "進度尚未儲存，下一次作答時會再試一次",
    });
    render();

    expect(statusMessages()).toEqual(["進度尚未儲存，下一次作答時會再試一次"]);
    expect(getButton("Learn").disabled).toBe(false);
  });

  it("credits the word list sources at the bottom of the page", () => {
    render();

    const footer = host.querySelector("footer");
    expect(footer?.textContent).toContain(CEFR_J_CREDIT);
    expect(footer?.textContent).toContain(OCTANOVE_CREDIT);
  });
});
