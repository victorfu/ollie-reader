import { describe, expect, it } from "vitest";
import {
  answerWords,
  isAcceptedAnswer,
  normalizeAnswer,
} from "./examAnswerMatching";

describe("normalizeAnswer", () => {
  const equivalent: [string, string][] = [
    // 大小寫/標點/空白
    ["Sit down, please.", "sit   down please"],
    ["I like dogs.", "I LIKE DOGS!!"],
    ["Yes, I can.", "yes i can"],
    // 全形標點(注音鍵盤常見)
    ["It's Sunday.", "It's Sunday。"],
    ["Where is the pen?", "Where is the pen？"],
    // 縮寫 ≡ 展開,撇號可省略
    ["I'm eight years old.", "I am eight years old"],
    ["I'm fine.", "im fine"],
    ["No, I don't.", "no i dont"],
    ["No, I can't.", "no i can not"],
    ["cannot", "can't"],
    ["It's in the box.", "It is in the box"],
    ["He's my teacher.", "he is my teacher"],
    ["They're in the desk.", "they are in the desk"],
    ["You're welcome.", "youre welcome"],
    ["Time's up.", "time is up"],
    ["Let's go.", "lets go"],
    // 彎引號 ≡ 直引號
    ["I’m eight.", "I'm eight."],
    // 數字 ≡ 英文數字
    ["I'm eight years old.", "I'm 8 years old."],
    ["Please turn to page 12.", "please turn to page twelve"],
    ["It's five dollars.", "its 5 dollars"],
    ["It's one o'clock.", "it is 1 oclock"],
    ["It's one o'clock.", "its one o clock"],
    // 連字號
    ["yo-yo", "yo yo"],
  ];

  it.each(equivalent)("treats %j ≡ %j", (a, b) => {
    expect(normalizeAnswer(a)).toBe(normalizeAnswer(b));
  });

  const different: [string, string][] = [
    ["I'm eight.", "I'm nine."],
    ["He is my teacher.", "She is my teacher."],
    ["Yes, I can.", "Yes, I do."],
    ["Sit down, please.", "Stand up, please."],
    ["It's in the box.", "It's on the box."],
  ];

  it.each(different)("keeps %j ≠ %j", (a, b) => {
    expect(normalizeAnswer(a)).not.toBe(normalizeAnswer(b));
  });
});

describe("isAcceptedAnswer", () => {
  const accepted = ["I'm eight years old.", "I'm eight."];

  it("accepts any listed variant through normalization", () => {
    expect(isAcceptedAnswer(accepted, "i am 8 years old")).toBe(true);
    expect(isAcceptedAnswer(accepted, "IM EIGHT")).toBe(true);
    expect(isAcceptedAnswer(accepted, "I'm eight. ")).toBe(true);
  });

  it("rejects wrong content", () => {
    expect(isAcceptedAnswer(accepted, "i am ten years old")).toBe(false);
    expect(isAcceptedAnswer(accepted, "eight")).toBe(false);
  });

  it("rejects empty and whitespace-only input", () => {
    expect(isAcceptedAnswer(accepted, "")).toBe(false);
    expect(isAcceptedAnswer(accepted, "   ")).toBe(false);
    expect(isAcceptedAnswer(accepted, "!!!")).toBe(false);
  });
});

describe("answerWords", () => {
  it("tokenizes with punctuation stripped and apostrophes kept", () => {
    expect(answerWords("Sit down, please.")).toEqual(["sit", "down", "please"]);
    expect(answerWords("I'm going to the park.")).toEqual([
      "i'm",
      "going",
      "to",
      "the",
      "park",
    ]);
  });

  it("matches multisets between scrambled hint and canonical answer", () => {
    const hint = "down / sit / please";
    const canonical = "Sit down, please.";
    expect([...answerWords(hint.replaceAll("/", " "))].sort()).toEqual(
      [...answerWords(canonical)].sort(),
    );
  });

  it("returns empty array for punctuation-only text", () => {
    expect(answerWords("...")).toEqual([]);
  });
});
