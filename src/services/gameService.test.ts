import { describe, expect, it, vi } from "vitest";
import type { VocabularyWord } from "../types/vocabulary";

vi.mock("./aiService", () => ({ generateGameWords: vi.fn() }));

import { prepareGamePool } from "./gameService";

const vocab = (
  word: string,
  examples: VocabularyWord["examples"] = [],
): VocabularyWord => ({
  word,
  userId: "u",
  definitions: [{ partOfSpeech: "noun", definition: "a thing" }],
  examples,
  synonyms: [],
  antonyms: [],
  tags: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  reviewCount: 0,
});

describe("prepareGamePool", () => {
  it("picks the first example that uses the word", async () => {
    const pool = await prepareGamePool([
      vocab("dog", [
        { sentence: "Bark loudly." },
        { sentence: "My dog barks.", translation: "我的狗在叫。" },
      ]),
      vocab("cat"),
      vocab("book"),
      vocab("apple"),
    ]);
    const dog = pool.find((w) => w.word === "dog");
    const cat = pool.find((w) => w.word === "cat");

    expect(dog?.example).toBe("My dog barks.");
    expect(dog?.exampleZh).toBe("我的狗在叫。");
    expect(cat?.example).toBeUndefined();
  });
});
