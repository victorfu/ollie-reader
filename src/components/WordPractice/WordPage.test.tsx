import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { HomeworkWord, PageSection, WordPageProgress } from "../../types/wordPractice";

const speech = vi.hoisted(() => ({
  speak: vi.fn(),
  speakAsync: vi.fn(),
  stopSpeaking: vi.fn(),
  isSpeaking: false,
  isLoadingAudio: false,
  speakingText: null as string | null,
}));
vi.mock("../../hooks/useSpeechState", () => ({ useSpeechState: () => speech }));

import { WordPage } from "./WordPage";

const RIVER: HomeworkWord = {
  key: "river",
  vocabularyId: "v-river",
  word: "river",
  emoji: "🌊",
  definitions: [
    { partOfSpeech: "noun", definition: "A large natural stream of water.", definitionChinese: "河流" },
  ],
  sentence: "The river is long.",
  cefr: { level: "A1", source: "list" },
};

const LOOK_FORWARD_TO: HomeworkWord = {
  key: "look forward to",
  vocabularyId: "v-lft",
  word: "look forward to",
  definitions: [
    { partOfSpeech: "phrase", definition: "To look forward to a party is to wait for it happily." },
  ],
  sentence: null,
  cefr: { level: "A2", source: "list" },
};

const RAN: HomeworkWord = {
  key: "run",
  vocabularyId: "v-run",
  word: "run",
  definitions: [{ partOfSpeech: "verb", definition: "To move fast on your feet.", definitionChinese: "跑" }],
  sentence: "Yesterday I ran to school.",
  cefr: { level: "A1", source: "list" },
};

let host: HTMLDivElement;
let root: Root;
let spy: Mock<(next: WordPageProgress) => void>;

function page(section: PageSection, extra: Partial<WordPageProgress> = {}): WordPageProgress {
  return { section, copies: 0, sentence: null, ...extra };
}

function render(node: React.ReactElement) {
  act(() => root.render(node));
}

function text(): string {
  return host.textContent ?? "";
}

function input(): HTMLInputElement {
  const el = host.querySelector("input:not([disabled])");
  if (!(el instanceof HTMLInputElement)) throw new Error("No input");
  return el;
}

function diffShown(): boolean {
  return host.querySelector('[role="img"]') !== null;
}

async function type(value: string) {
  const el = input();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
}

function show(word: HomeworkWord, progress: WordPageProgress) {
  render(<WordPage word={word} progress={progress} index={0} total={5} onChange={spy} />);
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  spy = vi.fn();
  speech.speakAsync.mockReset();
  speech.speakAsync.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("WordPage", () => {
  it("shows the word, both definitions and the example while looking", () => {
    show(RIVER, page("look"));
    expect(text()).toContain("river");
    expect(text()).toContain("A large natural stream of water.");
    expect(text()).toContain("河流");
    expect(text()).toContain("The river is long.");
  });

  it("plays the word once when the look section opens, then moves on to copying", () => {
    show(RIVER, page("look"));
    show(RIVER, page("look"));
    expect(speech.speakAsync).toHaveBeenCalledTimes(1);
    expect(speech.speakAsync).toHaveBeenCalledWith("river");
    const button = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("看完了"),
    )!;
    act(() => button.click());
    expect(spy).toHaveBeenCalledWith(page("copy"));
  });

  it("counts a copy only when it is spelled right, marking the mistake otherwise", async () => {
    show(RIVER, page("copy"));
    await type("rivr");
    expect(spy).not.toHaveBeenCalled();
    expect(diffShown()).toBe(true);
    expect(input().value).toBe("");
    await type("River ");
    expect(spy).toHaveBeenCalledWith({ ...page("copy"), copies: 1 });
  });

  it("moves on to recall after the third copy", async () => {
    show(RIVER, page("copy", { copies: 2 }));
    await type("river");
    expect(spy).toHaveBeenCalledWith({ ...page("recall"), copies: 3 });
  });

  it("hides the word everywhere while recalling, including inside the definition", () => {
    show(LOOK_FORWARD_TO, page("recall", { copies: 3 }));
    expect(text()).not.toMatch(/look forward to/i);
    expect(text()).toContain("____");
  });

  it("puts the recall input and its feedback above the definitions, so long ones need no scrolling", async () => {
    show(RIVER, page("recall", { copies: 3 }));
    const definition = () =>
      Array.from(host.querySelectorAll("p")).find((p) => p.textContent?.includes("natural stream"))!;
    const before = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(input(), definition())).toBe(true);
    await type("rivr");
    expect(before(host.querySelector('[role="img"]')!, definition())).toBe(true);
  });

  it("makes the learner recall again after a wrong spelling", async () => {
    show(RIVER, page("recall", { copies: 3 }));
    await type("rivr");
    expect(spy).not.toHaveBeenCalled();
    expect(diffShown()).toBe(true);
    expect(input().value).toBe("");
    await type("river");
    expect(spy).toHaveBeenCalledWith({ ...page("cloze"), copies: 3 });
  });

  it("goes straight from recall to the sentence for a word without an example", async () => {
    show(LOOK_FORWARD_TO, page("recall", { copies: 3 }));
    await type("Look  forward to");
    expect(spy).toHaveBeenCalledWith({ ...page("sentence"), copies: 3 });
  });

  it("shows the example with the word blanked out", () => {
    show(RAN, page("cloze", { copies: 3 }));
    expect(text()).toContain("例句填空");
    expect(text()).toContain("Yesterday I _____ to school.");
    expect(host.innerHTML).not.toMatch(/\bran\b/i);
  });

  it("asks for the form written in the sentence, showing it after a wrong answer", async () => {
    show(RAN, page("cloze", { copies: 3 }));
    await type("run");
    expect(spy).not.toHaveBeenCalled();
    expect(text()).toContain("正確答案是 ran");
    expect(diffShown()).toBe(true);
    expect(input().value).toBe("");
    await type("Ran");
    expect(spy).toHaveBeenCalledWith({ ...page("sentence"), copies: 3 });
  });

  it("continues an old page saved at the phrase step with the cloze", () => {
    show(RIVER, { ...page("look", { copies: 3 }), section: "phrase" } as unknown as WordPageProgress);
    expect(text()).toContain("The _____ is long.");
  });

  it("saves the sentence and finishes the page", async () => {
    show(RIVER, page("sentence", { copies: 3 }));
    await type("river");
    expect(text()).toContain("句子至少要 4 個英文字");
    expect(spy).not.toHaveBeenCalled();
    await type("The river is very long.");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ section: "done", sentence: "The river is very long." }),
    );
  });

  it("shows finished sections as one-line summaries", () => {
    show(RIVER, page("sentence", { copies: 3 }));
    expect(text()).toContain("✓ 抄寫 3 遍");
    expect(text()).toContain("✓ 默寫");
    expect(text()).toContain("✓ 例句填空");
    expect(text()).not.toContain("造詞");
  });
});
