import { describe, expect, it } from "vitest";
import { normalizeExamples } from "./normalizeExamples";

describe("normalizeExamples", () => {
  it("recovers string examples and alternate fields while preserving translations", () => {
    expect(normalizeExamples([
      " My tummy hurts. ",
      { sentence: " Rub your tummy. ", translation: " 揉揉肚子。 " },
      { english: "The ram is eating.", chinese: "公羊正在吃東西。" },
      { example: "The car rammed the gate." },
      { text: "Ram the clothes into the bag." },
      { sentence: " ", english: "A fallback sentence." },
    ])).toEqual([
      { sentence: "My tummy hurts." },
      { sentence: "Rub your tummy.", translation: "揉揉肚子。" },
      { sentence: "The ram is eating.", translation: "公羊正在吃東西。" },
      { sentence: "The car rammed the gate." },
      { sentence: "Ram the clothes into the bag." },
      { sentence: "A fallback sentence." },
    ]);
  });

  it("drops unusable entries so they cannot become blank cards or speech buttons", () => {
    expect(normalizeExamples([
      null, undefined, 42, [], {}, " ", { sentence: false },
      { sentence: { text: "not a string" } }, { translation: "只有中文" },
    ])).toEqual([]);
    for (const raw of [null, undefined, {}, "sentence"]) {
      expect(normalizeExamples(raw)).toEqual([]);
    }
  });
});
