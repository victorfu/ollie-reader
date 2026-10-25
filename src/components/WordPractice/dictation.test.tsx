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
        itemId="river"
        onChange={onChange}
      />,
    );
    expect(text()).toContain("訂正：照著打 3 遍");
    expect(text()).toContain("river");
    await type("river");
    expect(onChange).toHaveBeenCalledWith({ river: 1 });
  });
});

describe("an inflected word in the dictation", () => {
  const RUN: HomeworkWord = { ...word("run", "She ran home."), inflection: { form: "ran", kind: "past" } };
  const formItem = (answer: string | null): DictationItem => ({ ...item("run", answer), form: true });
  const homework = (dictation: DictationItem[]) => makeHomework(dictation, { newWords: [RUN], pages: [] });

  it("reads the form for the form item and names which form it is", async () => {
    render(<DictationStep homework={homework([item("run", "run"), formItem(null)])} itemIndex={1} onChange={onChange} />);
    await flush();
    expect(spoken()).toEqual(["ran", "She ran home.", "ran"]);
    expect(text()).toContain("提示：run 的過去式");
  });

  it("corrects the form item with the form", async () => {
    render(<CorrectionStep homework={homework([item("run", "run"), formItem("runned")])} itemId="run#form" onChange={onChange} />);
    expect(text()).toContain("ran");
    await type("ran");
    expect(onChange).toHaveBeenCalledWith({ "run#form": 1 });
  });

  it("lists a wrong form with the word it belongs to", () => {
    const done = homework([item("run", "run"), formItem("runned")]);
    render(<FinishedView homework={{ ...done, status: "completed" }} onBack={() => {}} />);
    expect(text()).toContain("ran（run 的過去式）");
    expect(text()).toContain("你寫的：runned");
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

  it("lists each word's sentence for the parent, and the phrase of an old homework", () => {
    render(<FinishedView homework={finished} onBack={noop} />);
    expect(text()).toContain("寫完了！");
    expect(text()).toContain("造句（給家長看）");
    expect(text()).toContain("a long river");
    expect(text()).toContain("The river is very long.");
    expect(text()).toContain("聽寫 1 / 2");
  });

  it("shows no phrase line for a homework written without the phrase step", () => {
    const noPhrase = {
      ...finished,
      pages: finished.pages.map((page) => ({ ...page, phrase: null })),
    };
    render(<FinishedView homework={noPhrase} onBack={noop} />);
    expect(text()).toContain("The river is very long.");
    expect(text()).not.toContain("a long river");
    expect(text()).not.toContain("造詞");
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

  describe("coins", () => {
    it("shows the coins earned and where each part came from", () => {
      const paid = {
        ...finished,
        reward: {
          coins: 58,
          items: [
            { kind: "handIn" as const, coins: 20 },
            { kind: "dictation" as const, coins: 3, count: 1 },
            { kind: "firstToday" as const, coins: 10 },
            { kind: "streak" as const, coins: 10, count: 3 },
            { kind: "perfect" as const, coins: 10 },
          ],
        },
      };
      render(<FinishedView homework={paid} onBack={noop} />);
      expect(text()).toContain("獲得 58 代幣！");
      expect(text()).toContain("交作業+20");
      expect(text()).toContain("聽寫寫對 1 題+3");
      expect(text()).toContain("今天第一份功課+10");
      expect(text()).toContain("連續寫功課 3 天+10");
      expect(text()).toContain("聽寫全對+10");
    });

    it("shows nothing about coins for a homework handed in before coins existed", () => {
      render(<FinishedView homework={finished} onBack={noop} />);
      expect(text()).not.toContain("代幣");
    });
  });

  describe("sentence review", () => {
    const reviewed = {
      ...finished,
      review: {
        reviewedAt: 5,
        items: [{ key: "river", ok: false, comment: "很好，但要用 very 修飾。", corrected: "The river is very, very long." }],
      },
    };

    it("shows Gemini's Chinese comment and the corrected sentence under the sentence", () => {
      render(<FinishedView homework={reviewed} onBack={noop} />);
      expect(text()).toContain("很好，但要用 very 修飾。");
      expect(text()).toContain("修正：The river is very, very long.");
    });

    it("shows a correct sentence's comment without a fix", () => {
      const ok = { ...reviewed, review: { reviewedAt: 5, items: [{ key: "river", ok: true, comment: "用法正確！" }] } };
      render(<FinishedView homework={ok} onBack={noop} />);
      expect(text()).toContain("用法正確！");
      expect(text()).not.toContain("修正：");
    });

    it("says the sentences are being reviewed", () => {
      render(<FinishedView homework={finished} onBack={noop} reviewState="reviewing" />);
      expect(text()).toContain("正在批改造句");
    });

    it("offers a retry when the review failed", async () => {
      const retry = vi.fn();
      render(<FinishedView homework={finished} onBack={noop} reviewState="failed" onReview={retry} />);
      expect(text()).toContain("還沒改好");
      await click("再改一次");
      expect(retry).toHaveBeenCalledTimes(1);
    });

    it("offers a review for a homework that has none yet", async () => {
      const review = vi.fn();
      render(<FinishedView homework={finished} onBack={noop} onReview={review} />);
      await click("批改造句");
      expect(review).toHaveBeenCalledTimes(1);
    });

    it("offers no review when there is no sentence to review", () => {
      const none = { ...finished, pages: finished.pages.map((page) => ({ ...page, sentence: null })) };
      render(<FinishedView homework={none} onBack={noop} onReview={vi.fn()} />);
      expect(text()).not.toContain("批改造句");
    });
  });
});
