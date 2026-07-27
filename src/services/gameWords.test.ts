import { describe, expect, it } from "vitest";
import { FALLBACK_GAME_WORDS } from "./gameWords";

const HAS_CJK = /[㐀-䶿一-鿿]/;

describe("FALLBACK_GAME_WORDS", () => {
  it("fills every field so both definition languages are playable", () => {
    expect(FALLBACK_GAME_WORDS.length).toBeGreaterThanOrEqual(20);
    FALLBACK_GAME_WORDS.forEach((seed) => {
      expect(seed.word.trim()).not.toBe("");
      expect(seed.def.trim()).not.toBe("");
      expect(seed.defEn.trim()).not.toBe("");
      expect(seed.emoji.trim()).not.toBe("");
    });
  });

  it("keeps the two definitions in their own languages", () => {
    FALLBACK_GAME_WORDS.forEach((seed) => {
      expect(HAS_CJK.test(seed.def)).toBe(true);
      expect(HAS_CJK.test(seed.defEn)).toBe(false);
    });
  });

  // 英文釋義若含被考的單字，spell/reverse 題就等於送分
  it("never leaks the head word inside its own English definition", () => {
    FALLBACK_GAME_WORDS.forEach((seed) => {
      expect(seed.defEn.toLowerCase()).not.toContain(seed.word.toLowerCase());
    });
  });
});
