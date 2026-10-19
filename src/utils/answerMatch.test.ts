import { expect, it } from "vitest";
import { diffSpelling, isAnswerCorrect, normalizeAnswer } from "./answerMatch";

it("normalizes whitespace, quotes and case", () => {
  expect(normalizeAnswer("  Don’t   Stop ")).toBe("don't stop");
  expect(isAnswerCorrect("Apple ", "apple")).toBe(true);
  expect(isAnswerCorrect("aple", "apple")).toBe(false);
  expect(isAnswerCorrect("well known", "well-known")).toBe(false);
});

it("converts both single and double curly quotes to straight quotes", () => {
  expect(normalizeAnswer("‘Hi’ “there”")).toBe("'hi' \"there\"");
  expect(isAnswerCorrect("Don’t", "don't")).toBe(true);
  expect(isAnswerCorrect("don't", "Don’t")).toBe(true);
  expect(isAnswerCorrect("“quote”", "\"quote\"")).toBe(true);
});

it("collapses any run of whitespace and trims the ends", () => {
  expect(normalizeAnswer("\t ice \n  cream  ")).toBe("ice cream");
  expect(isAnswerCorrect("ice   cream", "ice cream")).toBe(true);
  expect(isAnswerCorrect("icecream", "ice cream")).toBe(false);
});

it("treats an empty answer as correct only for an empty expectation", () => {
  expect(isAnswerCorrect("", "apple")).toBe(false);
  expect(isAnswerCorrect("   ", "apple")).toBe(false);
  expect(isAnswerCorrect("", "")).toBe(true);
});

it("marks the misspelled positions against the expected word", () => {
  expect(diffSpelling("aple", "apple")).toEqual([
    { text: "a", kind: "same" }, { text: "p", kind: "missing" }, { text: "ple", kind: "same" },
  ]);
  expect(diffSpelling("appel", "apple")).toEqual([
    { text: "app", kind: "same" }, { text: "le", kind: "wrong" },
  ]);
  expect(diffSpelling("apples", "apple")).toEqual([
    { text: "apple", kind: "same" }, { text: "s", kind: "extra" },
  ]);
  expect(diffSpelling("Apple", "apple")).toEqual([{ text: "apple", kind: "same" }]);
});

it("diffs after normalizing both sides", () => {
  expect(diffSpelling("  Aple ", "Apple")).toEqual([
    { text: "a", kind: "same" }, { text: "p", kind: "missing" }, { text: "ple", kind: "same" },
  ]);
  expect(diffSpelling("Don’t", "don't")).toEqual([{ text: "don't", kind: "same" }]);
});

it("shows the expected character for a wrong letter and the typed character for an extra one", () => {
  expect(diffSpelling("cat", "dog")).toEqual([{ text: "dog", kind: "wrong" }]);
  expect(diffSpelling("wellknown", "well-known")).toEqual([
    { text: "well", kind: "same" }, { text: "-", kind: "missing" }, { text: "known", kind: "same" },
  ]);
  expect(diffSpelling("axc", "ac")).toEqual([
    { text: "a", kind: "same" }, { text: "x", kind: "extra" }, { text: "c", kind: "same" },
  ]);
});

it("on equal cost prefers matching diagonally, which pushes the edit towards the start", () => {
  expect(diffSpelling("acc", "ac")).toEqual([
    { text: "a", kind: "same" }, { text: "c", kind: "extra" }, { text: "c", kind: "same" },
  ]);
});

it("handles empty input and empty expected without throwing", () => {
  expect(diffSpelling("", "apple")).toEqual([{ text: "apple", kind: "missing" }]);
  expect(diffSpelling("   ", "apple")).toEqual([{ text: "apple", kind: "missing" }]);
  expect(diffSpelling("apple", "")).toEqual([{ text: "apple", kind: "extra" }]);
  expect(diffSpelling("", "")).toEqual([]);
});
