import { describe, expect, it } from "vitest";
import {
  GACHA_CHARACTERS,
  GACHA_CHARACTER_IDS,
  getGachaCharacter,
  isGachaCharacterId,
} from "./gachaData";

describe("gacha character manifest", () => {
  it("keeps the original roster first and appends requested cartoon characters", () => {
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
      "crayon-shinchan",
      "misae-nohara",
      "hiroshi-nohara",
      "himawari-nohara",
      "shiro",
      "toru-kazama",
      "nene-sakurada",
      "masao-sato",
      "bo-chan",
      "nanako-ohara",
      "action-kamen",
      "waniyama-san",
      "buriburizaemon",
      "doraemon",
      "dorami",
      "nobita-nobi",
      "shizuka-minamoto",
      "takeshi-goda",
      "suneo-honekawa",
      "dekisugi",
    ]);
  });

  it("uses unique ids and a WebP asset for every character", () => {
    expect(new Set(GACHA_CHARACTER_IDS).size).toBe(57);
    expect(GACHA_CHARACTERS).toHaveLength(57);
    expect(GACHA_CHARACTERS.map((character) => character.id)).toEqual(
      GACHA_CHARACTER_IDS,
    );
    expect(
      new Set(GACHA_CHARACTERS.map((character) => character.imageUrl)).size,
    ).toBe(57);
    for (const character of GACHA_CHARACTERS) {
      expect(character.imageUrl).toMatch(/\.webp(?:$|\?)/);
      expect(character.name).not.toBe("");
      expect(character.englishName).not.toBe("");
    }
  });

  it("looks up known ids and rejects unknown ids", () => {
    expect(getGachaCharacter("kuromi").name).toBe("酷洛米");
    expect(getGachaCharacter("crayon-shinchan").name).toBe("蠟筆小新");
    expect(getGachaCharacter("waniyama-san").name).toBe("鱷魚阿山");
    expect(getGachaCharacter("buriburizaemon").name).toBe("肥嘟嘟左衛門");
    expect(getGachaCharacter("doraemon").name).toBe("哆啦A夢");
    expect(getGachaCharacter("dorami").name).toBe("哆啦美");
    expect(isGachaCharacterId("gudetama")).toBe(true);
    expect(isGachaCharacterId("unknown-character")).toBe(false);
  });
});
