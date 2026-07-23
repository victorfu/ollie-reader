import { GACHA_CHARACTERS } from "../../gacha-machine/gachaData";
import type { GachaCharacterId } from "../../gacha-machine/gachaTypes";
import type { Element, Rarity, TowerCharacter } from "../types";

/**
 * 扭蛋角色當塔時的元素與稀有度。
 *
 * 扭蛋機那邊只有名字和圖，塔系統還需要這兩個欄位：主元素決定打法、副元素決定
 * 特性（見 data/elements.ts 與 data/traits.ts），稀有度決定造價與強度。
 *
 * 型別寫成 Record<GachaCharacterId, …> 是刻意的——扭蛋機日後加角色時，
 * TypeScript 會直接編譯失敗要求補上，不會有人默默漏掉一個沒數值的角色。
 *
 * 指定原則：元素照角色形象（青蛙＝草葉/潮汐、酷洛米＝夢境/晶石、哆啦A夢＝
 * 晶石/閃電…）。稀有度照知名度，但**跟扭蛋的抽中機率無關**——扭蛋是均等抽的，
 * 這裡只是造價與強度的分級。
 */
const TOWER_TRAITS: Record<
  GachaCharacterId,
  { elements: [Element, ...Element[]]; rarity: Rarity }
> = {
  // === 三麗鷗 ===
  "hello-kitty": { elements: ["light", "star"], rarity: "mythling" },
  "my-melody": { elements: ["dream", "light"], rarity: "warden" },
  cinnamoroll: { elements: ["light", "dream"], rarity: "warden" },
  pompompurin: { elements: ["ember", "star"], rarity: "warden" },
  "little-twin-stars": { elements: ["star", "light"], rarity: "warden" },
  keroppi: { elements: ["leaf", "tide"], rarity: "common" },
  pochacco: { elements: ["spark", "leaf"], rarity: "common" },
  kuromi: { elements: ["dream", "crystal"], rarity: "warden" },
  "badtz-maru": { elements: ["tide", "crystal"], rarity: "rare" },
  tuxedosam: { elements: ["tide", "light"], rarity: "common" },
  hangyodon: { elements: ["tide", "dream"], rarity: "uncommon" },
  gudetama: { elements: ["dream"], rarity: "rare" },
  "minna-no-tabo": { elements: ["ember", "spark"], rarity: "common" },
  "my-sweet-piano": { elements: ["dream", "star"], rarity: "uncommon" },
  pekkle: { elements: ["tide", "spark"], rarity: "common" },
  "osaru-no-monkichi": { elements: ["spark", "ember"], rarity: "common" },
  marumofubiyori: { elements: ["dream", "leaf"], rarity: "uncommon" },
  "wish-me-mell": { elements: ["light", "dream"], rarity: "uncommon" },
  aggretsuko: { elements: ["ember", "spark"], rarity: "rare" },
  cogimyun: { elements: ["leaf", "light"], rarity: "common" },
  "little-forest-fellow": { elements: ["leaf", "dream"], rarity: "common" },
  hummingmint: { elements: ["leaf", "star"], rarity: "uncommon" },
  corocorokuririn: { elements: ["spark", "leaf"], rarity: "common" },
  usahana: { elements: ["star", "leaf"], rarity: "common" },
  bonbonribbon: { elements: ["star", "light"], rarity: "common" },
  "charmmy-kitty": { elements: ["crystal", "light"], rarity: "uncommon" },
  "marron-cream": { elements: ["leaf", "ember"], rarity: "common" },
  "we-are-dinosaurs": { elements: ["ember", "crystal"], rarity: "uncommon" },
  chococat: { elements: ["crystal", "spark"], rarity: "common" },
  "cheery-chums": { elements: ["star", "dream"], rarity: "common" },
  tenorikuma: { elements: ["ember", "dream"], rarity: "common" },
  "patty-and-jimmy": { elements: ["star", "spark"], rarity: "common" },
  sugarbunnies: { elements: ["light", "leaf"], rarity: "uncommon" },
  goropikadon: { elements: ["spark", "tide"], rarity: "rare" },
  mewkledreamy: { elements: ["dream", "star"], rarity: "rare" },
  "the-runabouts": { elements: ["spark", "crystal"], rarity: "common" },
  "nya-ni-nyu-nye-nyon": { elements: ["star", "tide"], rarity: "common" },

  // === 蠟筆小新 ===
  "crayon-shinchan": { elements: ["spark", "ember"], rarity: "mythling" },
  "misae-nohara": { elements: ["crystal", "ember"], rarity: "rare" },
  "hiroshi-nohara": { elements: ["ember", "crystal"], rarity: "rare" },
  "himawari-nohara": { elements: ["light", "star"], rarity: "uncommon" },
  shiro: { elements: ["light", "leaf"], rarity: "common" },
  "toru-kazama": { elements: ["crystal", "light"], rarity: "common" },
  "nene-sakurada": { elements: ["dream", "ember"], rarity: "common" },
  "masao-sato": { elements: ["tide", "dream"], rarity: "common" },
  "bo-chan": { elements: ["tide", "leaf"], rarity: "common" },
  "nanako-ohara": { elements: ["dream", "light"], rarity: "uncommon" },
  "action-kamen": { elements: ["ember", "star"], rarity: "warden" },
  "waniyama-san": { elements: ["leaf", "crystal"], rarity: "common" },
  buriburizaemon: { elements: ["ember", "light"], rarity: "rare" },

  // === 哆啦A夢 ===
  doraemon: { elements: ["crystal", "spark"], rarity: "mythling" },
  dorami: { elements: ["light", "crystal"], rarity: "warden" },
  "nobita-nobi": { elements: ["light", "tide"], rarity: "rare" },
  "shizuka-minamoto": { elements: ["tide", "star"], rarity: "rare" },
  "takeshi-goda": { elements: ["crystal", "dream"], rarity: "warden" },
  "suneo-honekawa": { elements: ["spark", "dream"], rarity: "uncommon" },
  dekisugi: { elements: ["star", "crystal"], rarity: "rare" },
};

/** 57 個扭蛋角色，補上塔需要的數值之後就是完整的塔資料。 */
export const CHARACTERS: TowerCharacter[] = GACHA_CHARACTERS.map((character) => ({
  id: character.id,
  name: character.englishName,
  nameZh: character.name,
  sprite: character.imageUrl,
  ...TOWER_TRAITS[character.id],
}));

const CHARACTERS_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string): TowerCharacter | undefined {
  return CHARACTERS_BY_ID.get(id);
}

/**
 * 沒抽過扭蛋也能用的班底。
 *
 * 六個都是最便宜的 common，而且湊齊六種最基本的打法：速射、糖漿、藤蔓、狙擊、
 * 爆裂、重砲。缺的催眠與應援比較花俏，留給扭蛋當驚喜——抽到 Hello Kitty
 * 比一開始就送她有感覺得多。
 */
export const DEFAULT_ROSTER_IDS: string[] = [
  "pochacco", // spark → 速射 · 毒液
  "tuxedosam", // tide → 糖漿 · 專注
  "keroppi", // leaf → 藤蔓 · 冰霜
  "shiro", // light → 狙擊 · 毒液
  "minna-no-tabo", // ember → 爆裂 · 連鎖
  "chococat", // crystal → 重砲 · 連鎖
];
