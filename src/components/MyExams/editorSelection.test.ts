import { describe, expect, it } from "vitest";
import {
  maskSelectionKey,
  parseSelectionKey,
  questionSelectionKey,
} from "./editorSelection";

describe("selection keys", () => {
  it("round-trips question and mask keys", () => {
    expect(parseSelectionKey(questionSelectionKey("abc123", 2))).toEqual({
      kind: "question",
      questionId: "abc123",
      regionIndex: 2,
    });
    expect(parseSelectionKey(maskSelectionKey(4))).toEqual({ kind: "mask", maskIndex: 4 });
  });

  it("rejects malformed keys", () => {
    expect(parseSelectionKey("q:abc")).toBeNull();
    expect(parseSelectionKey("q:abc:-1")).toBeNull();
    expect(parseSelectionKey("m:1.5")).toBeNull();
    expect(parseSelectionKey("x:1")).toBeNull();
  });
});
