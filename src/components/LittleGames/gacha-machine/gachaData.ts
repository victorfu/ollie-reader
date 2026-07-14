import aggretsukoImage from "../../../assets/games/gacha-machine/characters/aggretsuko.webp";
import badtzMaruImage from "../../../assets/games/gacha-machine/characters/badtz-maru.webp";
import bonbonribbonImage from "../../../assets/games/gacha-machine/characters/bonbonribbon.webp";
import charmmyKittyImage from "../../../assets/games/gacha-machine/characters/charmmy-kitty.webp";
import cheeryChumsImage from "../../../assets/games/gacha-machine/characters/cheery-chums.webp";
import cinnamorollImage from "../../../assets/games/gacha-machine/characters/cinnamoroll.webp";
import chococatImage from "../../../assets/games/gacha-machine/characters/chococat.webp";
import cogimyunImage from "../../../assets/games/gacha-machine/characters/cogimyun.webp";
import corocorokuririnImage from "../../../assets/games/gacha-machine/characters/corocorokuririn.webp";
import goropikadonImage from "../../../assets/games/gacha-machine/characters/goropikadon.webp";
import gudetamaImage from "../../../assets/games/gacha-machine/characters/gudetama.webp";
import hangyodonImage from "../../../assets/games/gacha-machine/characters/hangyodon.webp";
import helloKittyImage from "../../../assets/games/gacha-machine/characters/hello-kitty.webp";
import hummingmintImage from "../../../assets/games/gacha-machine/characters/hummingmint.webp";
import keroppiImage from "../../../assets/games/gacha-machine/characters/keroppi.webp";
import kuromiImage from "../../../assets/games/gacha-machine/characters/kuromi.webp";
import littleForestFellowImage from "../../../assets/games/gacha-machine/characters/little-forest-fellow.webp";
import littleTwinStarsImage from "../../../assets/games/gacha-machine/characters/little-twin-stars.webp";
import marronCreamImage from "../../../assets/games/gacha-machine/characters/marron-cream.webp";
import marumofubiyoriImage from "../../../assets/games/gacha-machine/characters/marumofubiyori.webp";
import mewkledreamyImage from "../../../assets/games/gacha-machine/characters/mewkledreamy.webp";
import minnaNoTaboImage from "../../../assets/games/gacha-machine/characters/minna-no-tabo.webp";
import myMelodyImage from "../../../assets/games/gacha-machine/characters/my-melody.webp";
import mySweetPianoImage from "../../../assets/games/gacha-machine/characters/my-sweet-piano.webp";
import nyaNiNyuNyeNyonImage from "../../../assets/games/gacha-machine/characters/nya-ni-nyu-nye-nyon.webp";
import osaruNoMonkichiImage from "../../../assets/games/gacha-machine/characters/osaru-no-monkichi.webp";
import pattyAndJimmyImage from "../../../assets/games/gacha-machine/characters/patty-and-jimmy.webp";
import pekkleImage from "../../../assets/games/gacha-machine/characters/pekkle.webp";
import pochaccoImage from "../../../assets/games/gacha-machine/characters/pochacco.webp";
import pompompurinImage from "../../../assets/games/gacha-machine/characters/pompompurin.webp";
import sugarbunniesImage from "../../../assets/games/gacha-machine/characters/sugarbunnies.webp";
import tenorikumaImage from "../../../assets/games/gacha-machine/characters/tenorikuma.webp";
import theRunaboutsImage from "../../../assets/games/gacha-machine/characters/the-runabouts.webp";
import tuxedosamImage from "../../../assets/games/gacha-machine/characters/tuxedosam.webp";
import usahanaImage from "../../../assets/games/gacha-machine/characters/usahana.webp";
import weAreDinosaursImage from "../../../assets/games/gacha-machine/characters/we-are-dinosaurs.webp";
import wishMeMellImage from "../../../assets/games/gacha-machine/characters/wish-me-mell.webp";
import type { GachaCharacter, GachaCharacterId } from "./gachaTypes";

export { GACHA_CHARACTER_IDS, isGachaCharacterId } from "./gachaTypes";

export const GACHA_CHARACTERS = [
  {
    id: "hello-kitty",
    name: "Hello Kitty",
    englishName: "Hello Kitty",
    imageUrl: helloKittyImage,
  },
  {
    id: "my-melody",
    name: "美樂蒂",
    englishName: "My Melody",
    imageUrl: myMelodyImage,
  },
  {
    id: "cinnamoroll",
    name: "大耳狗喜拿",
    englishName: "Cinnamoroll",
    imageUrl: cinnamorollImage,
  },
  {
    id: "pompompurin",
    name: "布丁狗",
    englishName: "Pompompurin",
    imageUrl: pompompurinImage,
  },
  {
    id: "little-twin-stars",
    name: "雙星仙子",
    englishName: "Little Twin Stars",
    imageUrl: littleTwinStarsImage,
  },
  {
    id: "keroppi",
    name: "大眼蛙",
    englishName: "Keroppi",
    imageUrl: keroppiImage,
  },
  {
    id: "pochacco",
    name: "帕恰狗",
    englishName: "Pochacco",
    imageUrl: pochaccoImage,
  },
  {
    id: "kuromi",
    name: "酷洛米",
    englishName: "Kuromi",
    imageUrl: kuromiImage,
  },
  {
    id: "badtz-maru",
    name: "酷企鵝",
    englishName: "Bad Badtz-Maru",
    imageUrl: badtzMaruImage,
  },
  {
    id: "tuxedosam",
    name: "山姆企鵝",
    englishName: "Tuxedosam",
    imageUrl: tuxedosamImage,
  },
  {
    id: "hangyodon",
    name: "人魚漢頓",
    englishName: "Hangyodon",
    imageUrl: hangyodonImage,
  },
  {
    id: "gudetama",
    name: "蛋黃哥",
    englishName: "Gudetama",
    imageUrl: gudetamaImage,
  },
  {
    id: "minna-no-tabo",
    name: "大寶",
    englishName: "Minna No Tabo",
    imageUrl: minnaNoTaboImage,
  },
  {
    id: "my-sweet-piano",
    name: "彼安諾",
    englishName: "My Sweet Piano",
    imageUrl: mySweetPianoImage,
  },
  {
    id: "pekkle",
    name: "貝克鴨",
    englishName: "Pekkle",
    imageUrl: pekkleImage,
  },
  {
    id: "osaru-no-monkichi",
    name: "淘氣猴",
    englishName: "Osaru no Monkichi",
    imageUrl: osaruNoMonkichiImage,
  },
  {
    id: "marumofubiyori",
    name: "毛毯熊莫普",
    englishName: "Marumofubiyori",
    imageUrl: marumofubiyoriImage,
  },
  {
    id: "wish-me-mell",
    name: "許願兔",
    englishName: "Wish Me Mell",
    imageUrl: wishMeMellImage,
  },
  {
    id: "aggretsuko",
    name: "衝吧！烈子",
    englishName: "Aggretsuko",
    imageUrl: aggretsukoImage,
  },
  {
    id: "cogimyun",
    name: "小麥粉精靈",
    englishName: "Cogimyun",
    imageUrl: cogimyunImage,
  },
  {
    id: "little-forest-fellow",
    name: "梅羅",
    englishName: "Little Forest Fellow",
    imageUrl: littleForestFellowImage,
  },
  {
    id: "hummingmint",
    name: "哈妮鹿",
    englishName: "Hummingmint",
    imageUrl: hummingmintImage,
  },
  {
    id: "corocorokuririn",
    name: "可樂鈴",
    englishName: "Corocorokuririn",
    imageUrl: corocorokuririnImage,
  },
  {
    id: "usahana",
    name: "花小兔",
    englishName: "U*SA*HA*NA",
    imageUrl: usahanaImage,
  },
  {
    id: "bonbonribbon",
    name: "蹦蹦兔",
    englishName: "Bonbonribbon",
    imageUrl: bonbonribbonImage,
  },
  {
    id: "charmmy-kitty",
    name: "Charmmykitty",
    englishName: "Charmmy Kitty",
    imageUrl: charmmyKittyImage,
  },
  {
    id: "marron-cream",
    name: "兔媽媽",
    englishName: "Marron Cream",
    imageUrl: marronCreamImage,
  },
  {
    id: "we-are-dinosaurs",
    name: "We Are Dinosaurs！",
    englishName: "We Are Dinosaurs!",
    imageUrl: weAreDinosaursImage,
  },
  {
    id: "chococat",
    name: "巧克貓",
    englishName: "Chococat",
    imageUrl: chococatImage,
  },
  {
    id: "cheery-chums",
    name: "Cheery Chums",
    englishName: "Cheery Chums",
    imageUrl: cheeryChumsImage,
  },
  {
    id: "tenorikuma",
    name: "掌上熊",
    englishName: "Tenorikuma",
    imageUrl: tenorikumaImage,
  },
  {
    id: "patty-and-jimmy",
    name: "帕蒂 & 吉米",
    englishName: "Patty & Jimmy",
    imageUrl: pattyAndJimmyImage,
  },
  {
    id: "sugarbunnies",
    name: "蜜糖邦尼",
    englishName: "Sugarbunnies",
    imageUrl: sugarbunniesImage,
  },
  {
    id: "goropikadon",
    name: "小雷公三兄弟",
    englishName: "Goropikadon",
    imageUrl: goropikadonImage,
  },
  {
    id: "mewkledreamy",
    name: "萌可魯玩偶貓",
    englishName: "Mewkledreamy",
    imageUrl: mewkledreamyImage,
  },
  {
    id: "the-runabouts",
    name: "樂跑小車",
    englishName: "The Runabouts",
    imageUrl: theRunaboutsImage,
  },
  {
    id: "nya-ni-nyu-nye-nyon",
    name: "喵喵家族",
    englishName: "Nya Ni Nyu Nye Nyon",
    imageUrl: nyaNiNyuNyeNyonImage,
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
