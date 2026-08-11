import { describe, expect, it } from "vitest";
import { matchesPronunciation } from "./textUtils";

describe("matchesPronunciation", () => {
  it("accepts a target word as a complete word in a longer utterance", () => {
    expect(matchesPronunciation("I said apple today", "apple")).toBe(true);
  });

  it("accepts a complete multi-word target phrase", () => {
    expect(matchesPronunciation("please say ice cream again", "ice cream")).toBe(
      true,
    );
  });

  it("does not accept a target embedded inside another word", () => {
    expect(matchesPronunciation("the", "he")).toBe(false);
    expect(matchesPronunciation("weather", "eat")).toBe(false);
  });

  it("does not match an empty target", () => {
    expect(matchesPronunciation("anything", "")).toBe(false);
  });
});
