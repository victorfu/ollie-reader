import { describe, expect, it } from "vitest";
import {
  GACHA_CHARACTERS,
  GACHA_CHARACTER_IDS,
  getGachaCharacter,
  isGachaCharacterId,
} from "./gachaData";

describe("gacha character manifest", () => {
  it("keeps the launch characters first and appends the official roster", () => {
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
      "minna-no-tabo",
      "my-sweet-piano",
      "pekkle",
      "osaru-no-monkichi",
      "marumofubiyori",
      "wish-me-mell",
      "aggretsuko",
      "cogimyun",
      "little-forest-fellow",
      "hummingmint",
      "corocorokuririn",
      "usahana",
      "bonbonribbon",
      "charmmy-kitty",
      "marron-cream",
      "we-are-dinosaurs",
      "chococat",
      "cheery-chums",
      "tenorikuma",
      "patty-and-jimmy",
      "sugarbunnies",
      "goropikadon",
      "mewkledreamy",
      "the-runabouts",
      "nya-ni-nyu-nye-nyon",
    ]);
  });

  it("uses unique ids and a WebP asset for every character", () => {
    expect(new Set(GACHA_CHARACTER_IDS).size).toBe(37);
    expect(GACHA_CHARACTERS).toHaveLength(37);
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
