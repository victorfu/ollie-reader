import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseWordPractice } from "../../hooks/useWordPractice";
import type {
  Homework,
  HomeworkWord,
  LegacyHomework,
  PracticeSettings,
} from "../../types/wordPractice";

const hook = vi.hoisted(() => ({ current: null as unknown as UseWordPractice }));
vi.mock("../../hooks/useWordPractice", () => ({ useWordPractice: () => hook.current }));
// The steps play words; the page is normally wrapped in SpeechProvider.
const speech = vi.hoisted(() => ({
  speak: vi.fn(),
  speakAsync: vi.fn(),
  stopSpeaking: vi.fn(),
  isSpeaking: false,
  isLoadingAudio: false,
  speakingText: null as string | null,
}));
vi.mock("../../hooks/useSpeechState", () => ({ useSpeechState: () => speech }));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import WordPracticePage from "./WordPracticePage";

const CEFR_J_CREDIT =
  "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.";
const OCTANOVE_CREDIT = "Octanove Vocabulary Profile (CC BY-SA 4.0)";
const SETTINGS: PracticeSettings = { newWordCount: 5, reviewLimit: 3, startLevel: "A1" };

let host: HTMLDivElement;
let root: Root;

function makeWord(word: string): HomeworkWord {
  return {
    key: word,
    vocabularyId: `vocab-${word}`,
    word,
    definitions: [{ partOfSpeech: "noun", definition: `Meaning of ${word}.` }],
    sentence: `I like the ${word}.`,
    cefr: { level: "A1", source: "list" },
  };
}

function makeHomework(overrides: Partial<Homework> = {}): Homework {
  const newWords = ["apple", "banana", "cherry", "date", "elder"].map(makeWord);
  return {
    version: 2,
    id: "hw-active",
    status: "active",
    createdAt: new Date(2026, 9, 19, 12).getTime(),
    newWords,
    reviewWords: [],
    pages: newWords.map((word, i) => ({
      section: i < 2 ? ("done" as const) : ("look" as const),
      copies: i < 2 ? 3 : 0,
      phrase: i < 2 ? `a ${word.word} pie` : null,
      sentence: i < 2 ? `I like the ${word.word} a lot.` : null,
    })),
    dictation: newWords.map((word) => ({
      key: word.key,
      source: "new" as const,
      answer: null,
      skipped: false,
    })),
    corrections: {},
    ...overrides,
  };
}

/** Every page and dictation answer is done and right, so only the submit button is left. */
function makeReadyToSubmit(): Homework {
  const homework = makeHomework();
  return {
    ...homework,
    pages: homework.newWords.map((word) => ({
      section: "done" as const,
      copies: 3,
      phrase: `a ${word.word} pie`,
      sentence: `I like the ${word.word} a lot.`,
    })),
    dictation: homework.newWords.map((word) => ({
      key: word.key,
      source: "new" as const,
      answer: word.word,
      skipped: false,
    })),
  };
}

function makeCompleted(): Homework {
  const homework = makeReadyToSubmit();
  return {
    ...homework,
    id: "hw-done",
    status: "completed",
    createdAt: new Date(2026, 9, 10, 12).getTime(),
    completedAt: new Date(2026, 9, 12, 12).getTime(),
    result: {
      correctKeys: homework.newWords.map((word) => word.key),
      wrongKeys: [],
      skippedKeys: [],
      correctCount: 5,
      total: 5,
    },
  };
}

function makeLegacy(): LegacyHomework {
  return {
    id: "hw-legacy",
    status: "completed",
    createdAt: new Date(2026, 8, 1, 12).getTime(),
    completedAt: new Date(2026, 8, 2, 12).getTime(),
    words: [
      { key: "apple", word: "apple" },
      { key: "banana", word: "banana" },
    ],
    result: { correctCount: 7, total: 10 },
  };
}

function makeHook(overrides: Partial<UseWordPractice> = {}): UseWordPractice {
  return {
    status: "ready",
    error: null,
    active: null,
    history: [],
    settings: SETTINGS,
    reviewDueCount: 3,
    homeworkStreak: { firstToday: true, days: 1 },
    starting: false,
    saveError: null,
    start: vi.fn().mockResolvedValue("created"),
    updateProgress: vi.fn(),
    submit: vi.fn().mockResolvedValue(null),
    abandon: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    reviewState: {},
    reviewHomework: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function render() {
  act(() => root.render(<WordPracticePage />));
}

function text(): string {
  return host.textContent ?? "";
}

function getButton(label: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`No button containing "${label}"`);
  return button;
}

async function click(label: string) {
  await act(async () => getButton(label).click());
}

function openSettings() {
  act(() => {
    host.querySelector("details")!.open = true;
  });
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
  speech.speakAsync.mockReset().mockResolvedValue(undefined);
  hook.current = makeHook();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe("home", () => {
  it("shows today's homework with no settings in sight, and starts it with one button", async () => {
    render();

    expect(text()).toContain("單字練習");
    expect(text()).toContain("今天的功課");
    expect(text()).toContain("5 個新字");
    expect(text()).toContain("3 個複習字");
    expect(host.querySelector("details")?.open).toBe(false);
    await click("開始寫功課");
    expect(hook.current.start).toHaveBeenCalledTimes(1);
  });

  it("keeps the CEFR credits in the footer", () => {
    render();
    expect(text()).toContain(CEFR_J_CREDIT);
    expect(text()).toContain(OCTANOVE_CREDIT);
  });

  it("continues an active homework at its current word", () => {
    hook.current = makeHook({ active: makeHomework() });
    render();

    expect(text()).toContain("繼續寫功課（第 3 / 5 個字）");
    expect(text()).not.toContain("開始寫功課");
  });

  it("shows the notice when there is nothing to practise", async () => {
    hook.current = makeHook({ start: vi.fn().mockResolvedValue("empty") });
    render();

    await click("開始寫功課");

    expect(text()).toContain("生詞本裡沒有可以練習的新單字");
  });

  it("clears the notice when the next start succeeds", async () => {
    const start = vi.fn().mockResolvedValueOnce("empty").mockResolvedValueOnce("created");
    hook.current = makeHook({ start });
    render();

    await click("開始寫功課");
    await click("開始寫功課");

    expect(text()).not.toContain("生詞本裡沒有可以練習的新單字");
  });

  it("tells the child a review-only homework has only dictation", async () => {
    hook.current = makeHook();
    render();
    await click("開始寫功課");
    const reviewOnly = { ...makeHomework(), newWords: [], pages: [] };
    hook.current = makeHook({ active: reviewOnly });
    render();

    expect(text()).toContain("生詞本裡沒有可以練習的新單字，這次只有聽寫");
  });

  it("does not show the review-only notice for a homework that is merely continued", () => {
    hook.current = makeHook({ active: { ...makeHomework(), newWords: [], pages: [] } });
    render();

    expect(text()).not.toContain("這次只有聽寫");
  });

  it("disables the start button and announces the wait while starting", () => {
    hook.current = makeHook({ starting: true });
    render();

    expect(getButton("開始寫功課").disabled).toBe(true);
    expect(text()).toContain("正在準備功課…");
  });

  it("offers a reload when loading failed", async () => {
    hook.current = makeHook({ status: "error", error: "載入單字練習失敗，請稍後再試" });
    render();

    await click("重新載入");
    expect(hook.current.reload).toHaveBeenCalledTimes(1);
  });

  it("shows a save warning without leaving the page", () => {
    hook.current = makeHook({ saveError: "進度尚未儲存，下一次作答時會再試一次" });
    render();
    expect(text()).toContain("進度尚未儲存");
  });
});

describe("parent settings", () => {
  it("keeps abandon inside the parent settings, behind a confirmation", async () => {
    hook.current = makeHook({ active: makeHomework() });
    render();

    expect(host.querySelector("details")?.open).toBe(false);
    openSettings();
    expect(text()).toContain("家長設定");
    expect(openDialog()).toBeNull();

    await click("放棄這份功課");
    expect(openDialog()?.textContent).toContain("放棄這份功課");
    expect(hook.current.abandon).not.toHaveBeenCalled();

    await act(async () => {
      Array.from(openDialog()!.querySelectorAll("button"))
        .find((button) => button.textContent === "放棄功課")!
        .click();
    });
    expect(hook.current.abandon).toHaveBeenCalledTimes(1);
  });

  it("saves the changed settings", async () => {
    render();
    openSettings();

    const select = host.querySelector<HTMLSelectElement>("select")!;
    act(() => {
      select.value = "8";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("儲存設定");

    expect(hook.current.saveSettings).toHaveBeenCalledWith({ ...SETTINGS, newWordCount: 8 });
  });

  it("has no abandon button when there is no homework in progress", () => {
    render();
    expect(text()).not.toContain("放棄這份功課");
  });
});

describe("homework book", () => {
  it("opens the current word's page after pressing continue, and rests back to the home", async () => {
    hook.current = makeHook({ active: makeHomework() });
    render();

    await click("繼續寫功課");
    expect(text()).toContain("先休息，等一下再寫");
    expect(text()).toContain("cherry");
    expect(text()).not.toContain("今天的功課");

    await click("先休息，等一下再寫");
    expect(text()).toContain("繼續寫功課（第 3 / 5 個字）");
  });

  it("goes from the last correction to submit, then to the finished view", async () => {
    const completed = makeCompleted();
    hook.current = makeHook({
      active: makeReadyToSubmit(),
      submit: vi.fn().mockResolvedValue(completed),
    });
    render();

    await click("繼續寫功課");
    expect(getButton("交作業")).toBeTruthy();

    await click("交作業");

    expect(hook.current.submit).toHaveBeenCalledTimes(1);
    expect(text()).toContain("寫完了！");
    expect(text()).toContain("聽寫 5 / 5");
    expect(text()).toContain("a apple pie");
  });

  it("stays on the submit button when submitting fails", async () => {
    hook.current = makeHook({ active: makeReadyToSubmit() });
    render();

    await click("繼續寫功課");
    await click("交作業");

    expect(getButton("交作業").disabled).toBe(false);
    expect(text()).not.toContain("寫完了！");
  });

  it("starts another homework from the finished view", async () => {
    hook.current = makeHook({
      active: makeReadyToSubmit(),
      submit: vi.fn().mockResolvedValue(makeCompleted()),
    });
    render();
    await click("繼續寫功課");
    await click("交作業");

    await click("再寫一份");
    expect(hook.current.start).toHaveBeenCalledTimes(1);
  });

  it("locks the controls while a replacement homework is being prepared", () => {
    hook.current = makeHook({ active: makeHomework(), starting: true });
    render();

    expect(getButton("繼續寫功課").disabled).toBe(true);
  });
});

describe("history", () => {
  it("says so when no homework has been finished", () => {
    render();
    expect(text()).toContain("還沒有完成的功課");
  });

  it("opens a legacy homework from the history with its date and score", async () => {
    hook.current = makeHook({ history: [makeLegacy()] });
    render();

    expect(text()).toContain("7 / 10");
    await click("7 / 10");

    expect(text()).toContain("2026/9/2");
    expect(text()).toContain("答對 7 / 10");
    expect(text()).toContain("apple");
    await click("回到首頁");
    expect(text()).toContain("今天的功課");
  });

  it("tells Ollie the homework earns coins, with the day's first bonus and the streak", () => {
    hook.current = makeHook({ homeworkStreak: { firstToday: true, days: 3 } });
    render();
    expect(text()).toContain("寫完可以拿到代幣");
    expect(text()).toContain("今天第一份 +10");
    expect(text()).toContain("連續第 3 天 +10");
  });

  it("leaves out the daily bonus once today's first homework is done", () => {
    hook.current = makeHook({ homeworkStreak: { firstToday: false, days: 3 } });
    render();
    expect(text()).toContain("寫完可以拿到代幣");
    expect(text()).not.toContain("今天第一份");
    expect(text()).not.toContain("連續第");
  });

  it("opens a finished homework with every word's phrase and sentence", async () => {
    hook.current = makeHook({ history: [makeCompleted()] });
    render();

    await click("5 / 5");

    expect(text()).toContain("a banana pie");
    expect(text()).toContain("I like the cherry a lot.");
  });

  it("shows the review as soon as it lands in the history, and retries a failed one", async () => {
    const done = makeCompleted();
    hook.current = makeHook({ history: [done], reviewState: { [done.id]: "failed" } });
    render();
    await click("5 / 5");
    expect(text()).toContain("還沒改好");

    await click("再改一次");
    expect(hook.current.reviewHomework).toHaveBeenCalledWith(expect.objectContaining({ id: done.id }));

    const comment = "用法正確！";
    hook.current = makeHook({
      history: [{ ...done, review: { reviewedAt: 1, items: [{ key: done.newWords[0].key, ok: true, comment }] } }],
    });
    render();
    expect(text()).toContain(comment);
  });
});
