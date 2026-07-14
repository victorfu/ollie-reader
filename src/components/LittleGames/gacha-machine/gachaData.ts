import badtzMaruImage from "../../../assets/games/gacha-machine/characters/badtz-maru.webp";
import cinnamorollImage from "../../../assets/games/gacha-machine/characters/cinnamoroll.webp";
import gudetamaImage from "../../../assets/games/gacha-machine/characters/gudetama.webp";
import hangyodonImage from "../../../assets/games/gacha-machine/characters/hangyodon.webp";
import helloKittyImage from "../../../assets/games/gacha-machine/characters/hello-kitty.webp";
import keroppiImage from "../../../assets/games/gacha-machine/characters/keroppi.webp";
import kuromiImage from "../../../assets/games/gacha-machine/characters/kuromi.webp";
import littleTwinStarsImage from "../../../assets/games/gacha-machine/characters/little-twin-stars.webp";
import myMelodyImage from "../../../assets/games/gacha-machine/characters/my-melody.webp";
import pochaccoImage from "../../../assets/games/gacha-machine/characters/pochacco.webp";
import pompompurinImage from "../../../assets/games/gacha-machine/characters/pompompurin.webp";
import tuxedosamImage from "../../../assets/games/gacha-machine/characters/tuxedosam.webp";
import type { GachaCharacter, GachaCharacterId } from "./gachaTypes";

export { GACHA_CHARACTER_IDS, isGachaCharacterId } from "./gachaTypes";

export const GACHA_CHARACTERS = [
  {
    id: "hello-kitty",
    name: "Hello Kitty",
    englishName: "Hello Kitty",
    imageUrl: helloKittyImage,
    capsuleColor: "#ff7597",
  },
  {
    id: "my-melody",
    name: "美樂蒂",
    englishName: "My Melody",
    imageUrl: myMelodyImage,
    capsuleColor: "#f69bc1",
  },
  {
    id: "cinnamoroll",
    name: "大耳狗喜拿",
    englishName: "Cinnamoroll",
    imageUrl: cinnamorollImage,
    capsuleColor: "#75ccec",
  },
  {
    id: "pompompurin",
    name: "布丁狗",
    englishName: "Pompompurin",
    imageUrl: pompompurinImage,
    capsuleColor: "#f4c554",
  },
  {
    id: "little-twin-stars",
    name: "雙星仙子",
    englishName: "Little Twin Stars",
    imageUrl: littleTwinStarsImage,
    capsuleColor: "#c6a5e9",
  },
  {
    id: "keroppi",
    name: "大眼蛙",
    englishName: "Keroppi",
    imageUrl: keroppiImage,
    capsuleColor: "#72c98a",
  },
  {
    id: "pochacco",
    name: "帕恰狗",
    englishName: "Pochacco",
    imageUrl: pochaccoImage,
    capsuleColor: "#77bde8",
  },
  {
    id: "kuromi",
    name: "酷洛米",
    englishName: "Kuromi",
    imageUrl: kuromiImage,
    capsuleColor: "#9d74cf",
  },
  {
    id: "badtz-maru",
    name: "酷企鵝",
    englishName: "Bad Badtz-Maru",
    imageUrl: badtzMaruImage,
    capsuleColor: "#68728a",
  },
  {
    id: "tuxedosam",
    name: "山姆企鵝",
    englishName: "Tuxedosam",
    imageUrl: tuxedosamImage,
    capsuleColor: "#5ba8d8",
  },
  {
    id: "hangyodon",
    name: "人魚漢頓",
    englishName: "Hangyodon",
    imageUrl: hangyodonImage,
    capsuleColor: "#63b9c8",
  },
  {
    id: "gudetama",
    name: "蛋黃哥",
    englishName: "Gudetama",
    imageUrl: gudetamaImage,
    capsuleColor: "#f6b936",
  },
] as const satisfies readonly GachaCharacter[];

const CHARACTER_BY_ID = new Map<GachaCharacterId, GachaCharacter>(
  GACHA_CHARACTERS.map((character) => [character.id, character]),
);

export function getGachaCharacter(
  id: GachaCharacterId,
): GachaCharacter {
  const character = CHARACTER_BY_ID.get(id);
  if (!character) {
    throw new Error(`Unknown gacha character: ${id}`);
  }
  return character;
}
