import { describe, expect, it } from "vitest";
import { normalizePartOfSpeech, singlePartOfSpeech } from "./partOfSpeech";

describe("normalizePartOfSpeech", () => {
  it("accepts common spellings and abbreviations", () => {
    expect(normalizePartOfSpeech("Noun")).toBe("noun");
    expect(normalizePartOfSpeech("n.")).toBe("noun");
    expect(normalizePartOfSpeech(" vt. ")).toBe("verb");
    expect(normalizePartOfSpeech("adj")).toBe("adjective");
    expect(normalizePartOfSpeech("adv.")).toBe("adverb");
  });

  it("ignores parts of speech the quiz does not ask about", () => {
    expect(normalizePartOfSpeech("preposition")).toBeUndefined();
    expect(normalizePartOfSpeech("phrase")).toBeUndefined();
    expect(normalizePartOfSpeech(3)).toBeUndefined();
  });
});

describe("singlePartOfSpeech", () => {
  it("returns the part of speech when every definition agrees", () => {
    expect(singlePartOfSpeech(["verb", "v.", "phrase"])).toBe("verb");
  });

  it("returns nothing when the word has several parts of speech", () => {
    expect(singlePartOfSpeech(["noun", "verb"])).toBeUndefined();
    expect(singlePartOfSpeech([])).toBeUndefined();
  });
});
