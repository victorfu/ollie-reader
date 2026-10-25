import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Homework, HomeworkWord, WordPageProgress } from "../types/wordPractice";

const mocks = vi.hoisted(() => ({ generateGeminiContent: vi.fn() }));
vi.mock("./geminiClient", () => ({ generateGeminiContent: mocks.generateGeminiContent }));

import { sentencesToReview } from "../utils/homeworkFlow";
import { reviewSentences } from "./sentenceReview";

const reply = (payload: unknown) =>
  mocks.generateGeminiContent.mockResolvedValue({
    response: { text: () => (typeof payload === "string" ? payload : JSON.stringify(payload)) },
  });

const word = (w: string): HomeworkWord => ({
  key: w,
  vocabularyId: `v-${w}`,
  word: w,
  definitions: [],
  sentence: null,
  cefr: null,
});
const page = (sentence: string | null): WordPageProgress => ({ section: "done", copies: 3, sentence });

const ITEMS = [
  { key: "river", word: "river", sentence: "The river is very wide." },
  { key: "curious", word: "curious", sentence: "I curious the cat." },
];

beforeEach(() => {
  mocks.generateGeminiContent.mockReset();
});

describe("sentencesToReview", () => {
  it("takes every new word's written sentence, in page order", () => {
    const hw = {
      newWords: [word("river"), word("moon"), word("curious")],
      pages: [page("The river is very wide."), page(null), page("  I curious the cat.  ")],
    } as Pick<Homework, "newWords" | "pages">;
    expect(sentencesToReview(hw)).toEqual([
      { key: "river", word: "river", sentence: "The river is very wide." },
      { key: "curious", word: "curious", sentence: "I curious the cat." },
    ]);
  });
});

describe("reviewSentences", () => {
  it("asks Gemini once for every sentence, with the sentence_review action", async () => {
    reply({ reviews: [] });
    await reviewSentences(ITEMS).catch(() => {});
    expect(mocks.generateGeminiContent).toHaveBeenCalledTimes(1);
    const [prompt, options] = mocks.generateGeminiContent.mock.calls[0];
    expect(options.action).toBe("sentence_review");
    expect(prompt).toContain("The river is very wide.");
    expect(prompt).toContain("I curious the cat.");
    expect(prompt).toContain("繁體中文");
  });

  it("returns a Chinese comment per sentence and a corrected sentence only when it needs fixing", async () => {
    reply({
      reviews: [
        { key: "river", ok: true, comment: "用法正確，很棒！", corrected: "The river is very wide." },
        { key: "curious", ok: false, comment: "curious 是形容詞，要搭配 be 動詞。", corrected: "I am curious about the cat." },
      ],
    });
    expect(await reviewSentences(ITEMS)).toEqual([
      { key: "river", ok: true, comment: "用法正確，很棒！" },
      {
        key: "curious",
        ok: false,
        comment: "curious 是形容詞，要搭配 be 動詞。",
        corrected: "I am curious about the cat.",
      },
    ]);
  });

  it("drops entries that were not asked about or are not usable", async () => {
    reply(
      "```json\n" +
        JSON.stringify({
          reviews: [
            { key: "moon", ok: true, comment: "很好" },
            { key: "river", ok: "yes", comment: "很好" },
            { key: "curious", ok: false, comment: "   " },
          ],
        }) +
        "\n```",
    );
    await expect(reviewSentences(ITEMS)).rejects.toThrow();
  });

  it("keeps the usable reviews when only some are usable, and drops a corrected sentence that is not English", async () => {
    reply({
      reviews: [
        { key: "river", ok: true, comment: "很好！" },
        { key: "curious", ok: false, comment: "要加 am。", corrected: "我很好奇" },
      ],
    });
    expect(await reviewSentences(ITEMS)).toEqual([
      { key: "river", ok: true, comment: "很好！" },
      { key: "curious", ok: false, comment: "要加 am。" },
    ]);
  });

  it("does not call Gemini when there is nothing to review", async () => {
    expect(await reviewSentences([])).toEqual([]);
    expect(mocks.generateGeminiContent).not.toHaveBeenCalled();
  });

  it("passes Gemini errors through", async () => {
    mocks.generateGeminiContent.mockRejectedValue(new Error("quota"));
    await expect(reviewSentences(ITEMS)).rejects.toThrow("quota");
  });
});
