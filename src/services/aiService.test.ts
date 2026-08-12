import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiRateLimitError } from "./geminiErrorPolicy";

const mocks = vi.hoisted(() => ({
  generateGeminiContent: vi.fn(),
}));

vi.mock("./geminiClient", () => ({
  generateGeminiContent: mocks.generateGeminiContent,
}));

import {
  generateGameWords,
  generateSpeechScript,
  generateWordDetails,
  getWordDefinition,
  parseAndTranslateSentences,
  smartLookup,
  translateWithAI,
} from "./aiService";

const response = (text: string) => ({
  response: { text: () => text },
});

describe("aiService Gemini boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes every AI action through the queued Gemini client", async () => {
    mocks.generateGeminiContent
      .mockResolvedValueOnce(
        response(
          JSON.stringify({
            definitions: [
              {
                partOfSpeech: "noun",
                definition: "a test word",
                definitionChinese: "測試字",
              },
            ],
            examples: [],
          }),
        ),
      )
      .mockResolvedValueOnce(response("翻譯"))
      .mockResolvedValueOnce(
        response(
          JSON.stringify({ kind: "sentence", chinese: "你好", keyWords: [] }),
        ),
      )
      .mockResolvedValueOnce(
        response(
          JSON.stringify({
            sentences: [{ english: "Hello.", chinese: "你好。" }],
          }),
        ),
      )
      .mockResolvedValueOnce(response("意思"))
      .mockResolvedValueOnce(response("講稿"))
      .mockResolvedValueOnce(
        response(
          JSON.stringify([
            { word: "brave", def: "勇敢的", defEn: "not afraid", emoji: "🦁" },
          ]),
        ),
      );

    await generateWordDetails("test");
    await translateWithAI("hello");
    await smartLookup("hello there");
    await parseAndTranslateSentences("Hello.");
    await getWordDefinition("hello");
    await generateSpeechScript("prompt");
    await generateGameWords(1);

    expect(
      mocks.generateGeminiContent.mock.calls.map((call) => call[1].action),
    ).toEqual([
      "word_details",
      "translation",
      "smart_lookup",
      "sentence_parse",
      "word_definition",
      "speech_script",
      "game_words",
    ]);
  });

  it("does not swallow a typed quota error or save it as a translation fallback", async () => {
    const error = new GeminiRateLimitError({
      kind: "daily_exhausted",
      retryable: false,
      quotaIds: ["RPD"],
    });
    mocks.generateGeminiContent.mockRejectedValue(error);

    await expect(generateWordDetails("test")).rejects.toBe(error);
    await expect(parseAndTranslateSentences("Hello.")).rejects.toBe(error);
  });

  it("propagates game generation cancellation to its run owner", async () => {
    const abort = new DOMException("cancelled", "AbortError");
    mocks.generateGeminiContent.mockRejectedValue(abort);

    await expect(generateGameWords(1)).rejects.toBe(abort);
  });
});
