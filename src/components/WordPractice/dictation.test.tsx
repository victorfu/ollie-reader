import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DictationItem, Homework, HomeworkWord } from "../../types/wordPractice";

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

import confetti from "canvas-confetti";
import { DictationStep } from "./DictationStep";
import { CorrectionStep } from "./CorrectionStep";
import { FinishedView } from "./FinishedView";

function word(key: string, sentence: string | null): HomeworkWord {
  return { key, vocabularyId: `v-${key}`, word: key, definitions: [], sentence, cefr: null };
}
const RIVER = word("river", "The river is long.");
const MOON = word("moon", null);

function item(key: string, answer: string | null, skipped = false): DictationItem {
  return { key, source: "new", answer, skipped };
}

function makeHomework(dictation: DictationItem[], extra: Partial<Homework> = {}): Homework {
  return {
    version: 2,
    id: "hw",
    status: "active",
    createdAt: 1,
    newWords: [RIVER, MOON],
    reviewWords: [],
    pages: [
      { section: "done", copies: 3, phrase: "a long river", sentence: "The river is very long." },
      { section: "done", copies: 3, phrase: null, sentence: null },
    ],
    dictation,
    corrections: {},
    ...extra,
  };
}

let host: HTMLDivElement;
let root: Root;
const onChange = vi.fn();
const noop = () => {};

const render = (node: React.ReactElement) => act(() => root.render(node));
const text = () => host.textContent ?? "";
const spoken = () => speech.speakAsync.mock.calls.map((c) => c[0]);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const withAnswers = (answers: (string | null)[]) =>
  makeHomework(answers.map((a, i) => item(i === 0 ? "river" : "moon", a)));

async function type(value: string) {
  const el = host.querySelector("input:not([disabled])") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
}
async function click(label: string) {
  const b = Array.from(host.querySelectorAll("button")).find((x) => x.textContent?.includes(label));
  if (!b) throw new Error(`No button ${label}`);
  await act(async () => b.click());
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  onChange.mockReset();
  speech.speakAsync.mockReset();
  speech.speakAsync.mockResolvedValue(undefined);
  speech.stopSpeaking.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("DictationStep", () => {
  const start = (hw = withAnswers([null, null]), index = 0) =>
    render(<DictationStep homework={hw} itemIndex={index} onChange={onChange} />);

  it("reads the word, the sentence and the word again", async () => {
    start();
    await flush();
    expect(spoken()).toEqual(["river", "The river is long.", "river"]);
    expect(text()).toContain("聽寫 1 / 2");
  });

  it("reads the word twice when it has no sentence", async () => {
    start(withAnswers([null, null]), 1);
    await flush();
    expect(spoken()).toEqual(["moon", "moon"]);
  });

  it("reads again on request", async () => {
    start();
    await flush();
    await click("再聽一次");
    await flush();
    expect(spoken()).toHaveLength(6);
  });

  it("records the answer without saying whether it is right", async () => {
    start();
    await type("rivr");
    expect(onChange).toHaveBeenCalledWith([item("river", "rivr"), item("moon", null)]);
    expect(text()).not.toMatch(/正確|錯|correct/i);
  });

  it("offers to retry and to skip when speech fails", async () => {
    speech.speakAsync.mockRejectedValue(new Error("x"));
    start(makeHomework([item("river", null)]));
    await flush();
    expect(text()).toContain("播放失敗，再試一次");
    await click("跳過這題");
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: "river", skipped: true })]);
  });

  it("never shows an earlier answer after a reload in the middle of dictation", () => {
    start(withAnswers(["rivr", null]), 1);
    expect(text()).not.toContain("rivr");
    expect(text()).not.toContain("river");
    expect(host.innerHTML).not.toContain("river");
  });
});

describe("CorrectionStep", () => {
  it("asks for three correct copies of a wrong word", async () => {
    render(
      <CorrectionStep
        homework={withAnswers(["rivr", null])}
        wordKey="river"
        onChange={onChange}
      />,
    );
    expect(text()).toContain("訂正：照著打 3 遍");
    expect(text()).toContain("river");
    await type("river");
    expect(onChange).toHaveBeenCalledWith({ river: 1 });
  });
});

describe("FinishedView", () => {
  const finished = makeHomework([item("river", "river"), item("moon", "mon")], {
    status: "completed",
    result: {
      correctKeys: ["river"],
      wrongKeys: ["moon"],
      skippedKeys: [],
      correctCount: 1,
      total: 2,
    },
  });

  it("lists each word's phrase and sentence for the parent", () => {
    render(<FinishedView homework={finished} onBack={noop} />);
    expect(text()).toContain("寫完了！");
    expect(text()).toContain("造詞和造句（給家長看）");
    expect(text()).toContain("a long river");
    expect(text()).toContain("The river is very long.");
    expect(text()).toContain("聽寫 1 / 2");
  });

  it("works with no new words and with every item skipped", () => {
    const hw = makeHomework([item("river", null, true)], {
      newWords: [],
      reviewWords: [RIVER],
      pages: [],
      status: "completed",
      result: { correctKeys: [], wrongKeys: [], skippedKeys: ["river"], correctCount: 0, total: 0 },
    });
    render(<FinishedView homework={hw} onBack={noop} />);
    expect(text()).toContain("寫完了！");
    expect(text()).not.toMatch(/NaN|Infinity/);
    expect(text()).not.toContain("聽寫 0 / 0");
  });

  it("lists the corrected words with the right spelling and what was typed", () => {
    render(<FinishedView homework={finished} onBack={noop} />);
    expect(text()).toContain("寫錯、已訂正的字");
    expect(text()).toContain("moon");
    expect(text()).toContain("mon");
    expect(text()).toContain("已訂正");
  });

  it("includes wrong review words, and omits the section when nothing was wrong", () => {
    const hw = makeHomework(
      [item("river", "river"), { key: "moon", source: "review", answer: "mun", skipped: false }],
      { status: "completed", newWords: [RIVER], reviewWords: [MOON] },
    );
    render(<FinishedView homework={hw} onBack={noop} />);
    expect(text()).toContain("寫錯、已訂正的字");
    expect(text()).toContain("mun");
    const clean = makeHomework([item("river", "river")], { status: "completed", newWords: [RIVER], reviewWords: [] });
    render(<FinishedView homework={clean} onBack={noop} />);
    expect(text()).not.toContain("寫錯、已訂正的字");
  });

  describe("confetti", () => {
    const perfect = makeHomework([item("river", "river"), item("moon", "moon")], { status: "completed" });
    beforeEach(() => vi.mocked(confetti).mockClear());

    it("fires for a perfect score right after submitting, honouring reduced motion", () => {
      render(<FinishedView homework={perfect} onBack={noop} celebrate />);
      expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ disableForReducedMotion: true }));
    });

    it("stays quiet when the homework is opened from the history", () => {
      render(<FinishedView homework={perfect} onBack={noop} />);
      expect(confetti).not.toHaveBeenCalled();
    });
  });

  it("calls onBack and onAgain", async () => {
    const again = vi.fn();
    const back = vi.fn();
    render(<FinishedView homework={finished} onBack={back} onAgain={again} />);
    await click("回到首頁");
    await click("再寫一份");
    expect(back).toHaveBeenCalled();
    expect(again).toHaveBeenCalled();
  });
});
