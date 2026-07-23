import lumiSprite from "../../../../assets/games/sweetheart-defenders/pets/lumi.png";
import momoSprite from "../../../../assets/games/sweetheart-defenders/pets/momo.png";
import picoSprite from "../../../../assets/games/sweetheart-defenders/pets/pico.png";
import nibiSprite from "../../../../assets/games/sweetheart-defenders/pets/nibi.png";
import mossmewSprite from "../../../../assets/games/sweetheart-defenders/pets/mossmew.png";
import sparkleafFawnSprite from "../../../../assets/games/sweetheart-defenders/pets/sparkleaf-fawn.png";
import pearlwhiskerSealSprite from "../../../../assets/games/sweetheart-defenders/pets/pearlwhisker-seal.png";
import clockbellTanukiSprite from "../../../../assets/games/sweetheart-defenders/pets/clockbell-tanuki.png";
import marshmallowMaestroSprite from "../../../../assets/games/sweetheart-defenders/pets/marshmallow-maestro.png";
import auroraAlpacaSprite from "../../../../assets/games/sweetheart-defenders/pets/aurora-alpaca.png";
import cometKitsuneSprite from "../../../../assets/games/sweetheart-defenders/pets/comet-kitsune.png";
import pillowmoonRamSprite from "../../../../assets/games/sweetheart-defenders/pets/pillowmoon-ram.png";
import glimmerbunSprite from "../../../../assets/games/sweetheart-defenders/pets/glimmerbun.png";
import tideshellOtterSprite from "../../../../assets/games/sweetheart-defenders/pets/tideshell-otter.png";
import embercapSalamanderSprite from "../../../../assets/games/sweetheart-defenders/pets/embercap-salamander.png";
import crystalmothSprite from "../../../../assets/games/sweetheart-defenders/pets/crystalmoth.png";
import sugarquillHedgehogSprite from "../../../../assets/games/sweetheart-defenders/pets/sugarquill-hedgehog.png";
import moonpaperCraneSprite from "../../../../assets/games/sweetheart-defenders/pets/moonpaper-crane.png";
import gearpawCubSprite from "../../../../assets/games/sweetheart-defenders/pets/gearpaw-cub.png";
import snowdriftPenguinSprite from "../../../../assets/games/sweetheart-defenders/pets/snowdrift-penguin.png";
import lanternNewtSprite from "../../../../assets/games/sweetheart-defenders/pets/lantern-newt.png";
import cloverwhirlSnailSprite from "../../../../assets/games/sweetheart-defenders/pets/cloverwhirl-snail.png";
import prismbellGryphonSprite from "../../../../assets/games/sweetheart-defenders/pets/prismbell-gryphon.png";
import dewdropSproutSprite from "../../../../assets/games/sweetheart-defenders/pets/dewdrop-sprout.png";
import acornSpriteSprite from "../../../../assets/games/sweetheart-defenders/pets/acorn-sprite.png";
import bubblefinPonySprite from "../../../../assets/games/sweetheart-defenders/pets/bubblefin-pony.png";
import coralpuffTurtleSprite from "../../../../assets/games/sweetheart-defenders/pets/coralpuff-turtle.png";
import driftpearlCrabSprite from "../../../../assets/games/sweetheart-defenders/pets/driftpearl-crab.png";
import ticktockSparrowSprite from "../../../../assets/games/sweetheart-defenders/pets/ticktock-sparrow.png";
import brassbuttonMoleSprite from "../../../../assets/games/sweetheart-defenders/pets/brassbutton-mole.png";
import keyringFerretSprite from "../../../../assets/games/sweetheart-defenders/pets/keyring-ferret.png";
import syrupwingBatSprite from "../../../../assets/games/sweetheart-defenders/pets/syrupwing-bat.png";
import gumdropGoatSprite from "../../../../assets/games/sweetheart-defenders/pets/gumdrop-goat.png";
import cinnamonImpSprite from "../../../../assets/games/sweetheart-defenders/pets/cinnamon-imp.png";
import frostbellHareSprite from "../../../../assets/games/sweetheart-defenders/pets/frostbell-hare.png";
import iciclePupSprite from "../../../../assets/games/sweetheart-defenders/pets/icicle-pup.png";
import cocoaYakSprite from "../../../../assets/games/sweetheart-defenders/pets/cocoa-yak.png";
import lullabyJellySprite from "../../../../assets/games/sweetheart-defenders/pets/lullaby-jelly.png";
import dreamcapBakuSprite from "../../../../assets/games/sweetheart-defenders/pets/dreamcap-baku.png";
import blanketBatSprite from "../../../../assets/games/sweetheart-defenders/pets/blanket-bat.png";
import stardialTortoiseSprite from "../../../../assets/games/sweetheart-defenders/pets/stardial-tortoise.png";
import meteorMarmosetSprite from "../../../../assets/games/sweetheart-defenders/pets/meteor-marmoset.png";
import nebulaLynxSprite from "../../../../assets/games/sweetheart-defenders/pets/nebula-lynx.png";
import bellvineSerpentSprite from "../../../../assets/games/sweetheart-defenders/pets/bellvine-serpent.png";
import mirrorpawCatSprite from "../../../../assets/games/sweetheart-defenders/pets/mirrorpaw-cat.png";
import quartzKoiSprite from "../../../../assets/games/sweetheart-defenders/pets/quartz-koi.png";
import chimewingSwanSprite from "../../../../assets/games/sweetheart-defenders/pets/chimewing-swan.png";
import silentBellheartSprite from "../../../../assets/games/sweetheart-defenders/pets/silent-bellheart.png";
import type { Pet } from "../types";

// 48 隻寵物（4 隻 starter + 44 隻）。名稱、元素、稀有度沿用 Wonder Academy 的
// 設定；主元素決定塔的攻擊原型（見 data/elements.ts），稀有度決定造價與數值
// 倍率（見 constants.ts 的 RARITY_TIERS）。
export const PETS: Pet[] = [
  {
    id: "lumi",
    name: "Lumi",
    nameZh: "星光小狐",
    elements: ["light", "spark"],
    rarity: "common",
    sprite: lumiSprite,
  },
  {
    id: "momo",
    name: "Momo",
    nameZh: "雲朵小貓",
    elements: ["dream", "tide"],
    rarity: "common",
    sprite: momoSprite,
  },
  {
    id: "pico",
    name: "Pico",
    nameZh: "星塵小妖精",
    elements: ["star", "leaf"],
    rarity: "common",
    sprite: picoSprite,
  },
  {
    id: "nibi",
    name: "Nibi",
    nameZh: "迷你小龍",
    elements: ["ember", "crystal"],
    rarity: "common",
    sprite: nibiSprite,
  },
  {
    id: "mossmew",
    name: "Mossmew",
    nameZh: "苔蘚小鼠",
    elements: ["leaf"],
    rarity: "common",
    sprite: mossmewSprite,
  },
  {
    id: "sparkleaf-fawn",
    name: "Sparkleaf Fawn",
    nameZh: "星葉小鹿",
    elements: ["leaf", "light"],
    rarity: "uncommon",
    sprite: sparkleafFawnSprite,
  },
  {
    id: "pearlwhisker-seal",
    name: "Pearlwhisker Seal",
    nameZh: "珍珠鬍海豹",
    elements: ["tide", "dream"],
    rarity: "rare",
    sprite: pearlwhiskerSealSprite,
  },
  {
    id: "clockbell-tanuki",
    name: "Clockbell Tanuki",
    nameZh: "鐘鈴狸",
    elements: ["crystal", "star"],
    rarity: "warden",
    sprite: clockbellTanukiSprite,
  },
  {
    id: "marshmallow-maestro",
    name: "Marshmallow Maestro",
    nameZh: "棉花糖指揮家",
    elements: ["dream", "light"],
    rarity: "rare",
    sprite: marshmallowMaestroSprite,
  },
  {
    id: "aurora-alpaca",
    name: "Aurora Alpaca",
    nameZh: "極光羊駝",
    elements: ["light", "crystal"],
    rarity: "warden",
    sprite: auroraAlpacaSprite,
  },
  {
    id: "comet-kitsune",
    name: "Comet Kitsune",
    nameZh: "彗星小狐",
    elements: ["star", "spark"],
    rarity: "rare",
    sprite: cometKitsuneSprite,
  },
  {
    id: "pillowmoon-ram",
    name: "Pillowmoon Ram",
    nameZh: "枕月綿羊",
    elements: ["dream", "star"],
    rarity: "rare",
    sprite: pillowmoonRamSprite,
  },
  {
    id: "glimmerbun",
    name: "Glimmerbun",
    nameZh: "光葉兔",
    elements: ["light", "leaf"],
    rarity: "common",
    sprite: glimmerbunSprite,
  },
  {
    id: "tideshell-otter",
    name: "Tideshell Otter",
    nameZh: "潮貝水獺",
    elements: ["tide", "spark"],
    rarity: "uncommon",
    sprite: tideshellOtterSprite,
  },
  {
    id: "embercap-salamander",
    name: "Embercap Salamander",
    nameZh: "火帽蠑螈",
    elements: ["ember", "leaf"],
    rarity: "common",
    sprite: embercapSalamanderSprite,
  },
  {
    id: "crystalmoth",
    name: "Crystalmoth",
    nameZh: "晶翼蛾",
    elements: ["crystal", "star"],
    rarity: "uncommon",
    sprite: crystalmothSprite,
  },
  {
    id: "sugarquill-hedgehog",
    name: "Sugarquill Hedgehog",
    nameZh: "糖刺刺蝟",
    elements: ["dream", "ember"],
    rarity: "rare",
    sprite: sugarquillHedgehogSprite,
  },
  {
    id: "moonpaper-crane",
    name: "Moonpaper Crane",
    nameZh: "月紙鶴",
    elements: ["dream", "star"],
    rarity: "rare",
    sprite: moonpaperCraneSprite,
  },
  {
    id: "gearpaw-cub",
    name: "Gearpaw Cub",
    nameZh: "齒輪小熊",
    elements: ["crystal", "spark"],
    rarity: "uncommon",
    sprite: gearpawCubSprite,
  },
  {
    id: "snowdrift-penguin",
    name: "Snowdrift Penguin",
    nameZh: "雪鈴企鵝",
    elements: ["tide", "crystal"],
    rarity: "common",
    sprite: snowdriftPenguinSprite,
  },
  {
    id: "lantern-newt",
    name: "Lantern Newt",
    nameZh: "燈籠蠑螈",
    elements: ["light", "ember"],
    rarity: "uncommon",
    sprite: lanternNewtSprite,
  },
  {
    id: "cloverwhirl-snail",
    name: "Cloverwhirl Snail",
    nameZh: "幸運旋蝸",
    elements: ["leaf", "dream"],
    rarity: "common",
    sprite: cloverwhirlSnailSprite,
  },
  {
    id: "prismbell-gryphon",
    name: "Prismbell Gryphon",
    nameZh: "稜鐘幼獅鷲",
    elements: ["light", "star"],
    rarity: "warden",
    sprite: prismbellGryphonSprite,
  },
  {
    id: "dewdrop-sprout",
    name: "Dewdrop Sprout",
    nameZh: "晨露芽苗",
    elements: ["leaf", "tide"],
    rarity: "common",
    sprite: dewdropSproutSprite,
  },
  {
    id: "acorn-sprite",
    name: "Acorn Sprite",
    nameZh: "橡果小精靈",
    elements: ["leaf", "star"],
    rarity: "uncommon",
    sprite: acornSpriteSprite,
  },
  {
    id: "bubblefin-pony",
    name: "Bubblefin Pony",
    nameZh: "泡鰭小馬",
    elements: ["tide", "spark"],
    rarity: "uncommon",
    sprite: bubblefinPonySprite,
  },
  {
    id: "coralpuff-turtle",
    name: "Coralpuff Turtle",
    nameZh: "珊瑚泡泡龜",
    elements: ["tide", "leaf"],
    rarity: "common",
    sprite: coralpuffTurtleSprite,
  },
  {
    id: "driftpearl-crab",
    name: "Driftpearl Crab",
    nameZh: "漂珠小蟹",
    elements: ["tide", "crystal"],
    rarity: "rare",
    sprite: driftpearlCrabSprite,
  },
  {
    id: "ticktock-sparrow",
    name: "Ticktock Sparrow",
    nameZh: "滴答麻雀",
    elements: ["spark", "star"],
    rarity: "common",
    sprite: ticktockSparrowSprite,
  },
  {
    id: "brassbutton-mole",
    name: "Brassbutton Mole",
    nameZh: "銅釦地鼠",
    elements: ["crystal", "ember"],
    rarity: "uncommon",
    sprite: brassbuttonMoleSprite,
  },
  {
    id: "keyring-ferret",
    name: "Keyring Ferret",
    nameZh: "鑰圈雪貂",
    elements: ["spark", "crystal"],
    rarity: "rare",
    sprite: keyringFerretSprite,
  },
  {
    id: "syrupwing-bat",
    name: "Syrupwing Bat",
    nameZh: "糖漿小蝠",
    elements: ["dream", "ember"],
    rarity: "common",
    sprite: syrupwingBatSprite,
  },
  {
    id: "gumdrop-goat",
    name: "Gumdrop Goat",
    nameZh: "軟糖小山羊",
    elements: ["dream", "light"],
    rarity: "uncommon",
    sprite: gumdropGoatSprite,
  },
  {
    id: "cinnamon-imp",
    name: "Cinnamon Imp",
    nameZh: "肉桂小鬼",
    elements: ["ember", "dream"],
    rarity: "rare",
    sprite: cinnamonImpSprite,
  },
  {
    id: "frostbell-hare",
    name: "Frostbell Hare",
    nameZh: "霜鈴野兔",
    elements: ["crystal", "light"],
    rarity: "common",
    sprite: frostbellHareSprite,
  },
  {
    id: "icicle-pup",
    name: "Icicle Pup",
    nameZh: "冰柱小犬",
    elements: ["tide", "crystal"],
    rarity: "uncommon",
    sprite: iciclePupSprite,
  },
  {
    id: "cocoa-yak",
    name: "Cocoa Yak",
    nameZh: "可可小犛牛",
    elements: ["ember", "crystal"],
    rarity: "rare",
    sprite: cocoaYakSprite,
  },
  {
    id: "lullaby-jelly",
    name: "Lullaby Jelly",
    nameZh: "搖籃水母",
    elements: ["dream", "tide"],
    rarity: "common",
    sprite: lullabyJellySprite,
  },
  {
    id: "dreamcap-baku",
    name: "Dreamcap Baku",
    nameZh: "夢帽貘",
    elements: ["dream", "leaf"],
    rarity: "rare",
    sprite: dreamcapBakuSprite,
  },
  {
    id: "blanket-bat",
    name: "Blanket Bat",
    nameZh: "被毯小蝠",
    elements: ["dream", "star"],
    rarity: "uncommon",
    sprite: blanketBatSprite,
  },
  {
    id: "stardial-tortoise",
    name: "Stardial Tortoise",
    nameZh: "星晷小龜",
    elements: ["star", "crystal"],
    rarity: "rare",
    sprite: stardialTortoiseSprite,
  },
  {
    id: "meteor-marmoset",
    name: "Meteor Marmoset",
    nameZh: "流星狨猴",
    elements: ["spark", "star"],
    rarity: "common",
    sprite: meteorMarmosetSprite,
  },
  {
    id: "nebula-lynx",
    name: "Nebula Lynx",
    nameZh: "星雲小猞猁",
    elements: ["star", "light"],
    rarity: "rare",
    sprite: nebulaLynxSprite,
  },
  {
    id: "bellvine-serpent",
    name: "Bellvine Serpent",
    nameZh: "鈴藤小蛇",
    elements: ["leaf", "crystal"],
    rarity: "uncommon",
    sprite: bellvineSerpentSprite,
  },
  {
    id: "mirrorpaw-cat",
    name: "Mirrorpaw Cat",
    nameZh: "鏡爪小貓",
    elements: ["crystal", "dream"],
    rarity: "rare",
    sprite: mirrorpawCatSprite,
  },
  {
    id: "quartz-koi",
    name: "Quartz Koi",
    nameZh: "石英錦鯉",
    elements: ["tide", "crystal"],
    rarity: "uncommon",
    sprite: quartzKoiSprite,
  },
  {
    id: "chimewing-swan",
    name: "Chimewing Swan",
    nameZh: "鳴翼天鵝",
    elements: ["light", "crystal"],
    rarity: "warden",
    sprite: chimewingSwanSprite,
  },
  {
    id: "silent-bellheart",
    name: "Silent Bellheart",
    nameZh: "靜鐘之心",
    elements: ["light", "crystal"],
    rarity: "mythling",
    sprite: silentBellheartSprite,
  },
];

const PETS_BY_ID = new Map(PETS.map((pet) => [pet.id, pet]));

export function getPet(id: string): Pet | undefined {
  return PETS_BY_ID.get(id);
}

/**
 * 開場就能用的寵物，其餘靠通關解鎖。
 *
 * 六隻剛好涵蓋六種打法（狙擊 / 催眠 / 應援 / 爆裂 / 藤蔓 / 速射），
 * 缺的糖漿與重砲留給第一關的解鎖獎勵，讓第一次通關就有明顯的新東西可以玩。
 */
export const STARTER_PET_IDS = [
  "lumi", // light + spark → 狙擊 · 連鎖
  "momo", // dream + tide → 催眠 · 冰霜
  "pico", // star + leaf → 應援 · 毒液
  "nibi", // ember + crystal → 爆裂 · 碎甲
  "mossmew", // leaf → 藤蔓 · 純粹
  "ticktock-sparrow", // spark + star → 速射 · 連擊
];
