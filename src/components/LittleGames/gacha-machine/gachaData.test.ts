import { describe, expect, it } from "vitest";
import {
  GACHA_CHARACTERS,
  GACHA_CHARACTER_IDS,
  getGachaCharacter,
  isGachaCharacterId,
} from "./gachaData";

describe("gacha character manifest", () => {
  it("contains the 12 launch characters in collection order", () => {
    expect(GACHA_CHARACTER_IDS).toEqual([
      "hello-kitty",
      "my-melody",
      "cinnamoroll",
      "pompompurin",
      "little-twin-stars",
      "keroppi",
      "pochacco",
      "kuromi",
      "badtz-maru",
      "tuxedosam",
      "hangyodon",
      "gudetama",
    ]);
  });

  it("uses unique ids and a WebP asset for every character", () => {
    expect(new Set(GACHA_CHARACTER_IDS).size).toBe(12);
    expect(GACHA_CHARACTERS).toHaveLength(12);
    for (const character of GACHA_CHARACTERS) {
      expect(character.imageUrl).toMatch(/\.webp(?:$|\?)/);
      expect(character.name).not.toBe("");
      expect(character.englishName).not.toBe("");
    }
  });

  it("looks up known ids and rejects unknown ids", () => {
    expect(getGachaCharacter("kuromi").name).toBe("酷洛米");
    expect(isGachaCharacterId("gudetama")).toBe(true);
    expect(isGachaCharacterId("unknown-character")).toBe(false);
  });
});
