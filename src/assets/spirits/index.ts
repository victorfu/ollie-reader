import type { Spirit, SpiritElement, SpiritRarity } from "../../types/game";
import FireSlime from "./FireSlime";
import WaterFox from "./WaterFox";
import LeafBunny from "./LeafBunny";
import ThunderMouse from "./ThunderMouse";
import CloudPuff from "./CloudPuff";
import RockTurtle from "./RockTurtle";
import FlowerSprite from "./FlowerSprite";
import IceWolf from "./IceWolf";
import FirePhoenix from "./FirePhoenix";
import ThunderDragon from "./ThunderDragon";
import StarOwl from "./StarOwl";
import ShadowCat from "./ShadowCat";
import EarthGolem from "./EarthGolem";
import WindEagle from "./WindEagle";
import { NEW_SPIRITS, NEW_SPIRIT_COMPONENTS } from "./newSpirits";

// 精靈資料清單
export const SPIRITS: Spirit[] = [
  {
    id: "fire-slime",
    name: "火焰史萊姆",
    element: "fire",
    rarity: "common",
    description: "圓滾滾的小火球，總是溫暖地發著光。",
    evolvesToId: "blaze-drake",
    evolveCondition: { type: "train", element: "fire", correctCount: 12 },
  },
  {
    id: "water-fox",
    name: "水滴狐狸",
    element: "water",
    rarity: "common",
    description: "優雅的藍色狐狸，喜歡在雨天出現。",
    evolvesToId: "tide-fox",
    evolveCondition: { type: "train", element: "water", correctCount: 12 },
  },
  {
    id: "leaf-bunny",
    name: "葉子兔",
    element: "grass",
    rarity: "common",
    description: "活潑好動的綠色兔兔，耳朵上會長出小葉子。",
    evolvesToId: "forest-deer",
    evolveCondition: { type: "train", element: "grass", correctCount: 12 },
  },
  {
    id: "thunder-mouse",
    name: "雷電鼠",
    element: "electric",
    rarity: "common",
    description: "充滿活力的小老鼠，臉頰會發出電光。",
  },
  {
    id: "cloud-puff",
    name: "棉花雲",
    element: "normal",
    rarity: "common",
    description: "軟綿綿的雲朵精靈，心情好的時候會飄起來。",
  },
  {
    id: "rock-turtle",
    name: "岩石龜",
    element: "water",
    rarity: "uncommon",
    description: "穩重的烏龜精靈，殼上有美麗的花紋。",
  },
  {
    id: "flower-sprite",
    name: "花朵精靈",
    element: "grass",
    rarity: "uncommon",
    description: "頭上開著美麗花朵的精靈，會隨音樂跳舞。",
  },
  {
    id: "ice-wolf",
    name: "冰晶狼",
    element: "water",
    rarity: "rare",
    description: "帥氣的冰屬性狼，身上閃爍著藍色光芒。",
  },
  {
    id: "fire-phoenix",
    name: "火焰鳳凰",
    element: "fire",
    rarity: "legendary",
    description: "傳說中的神鳥，象徵著永不放棄的精神。",
  },
  {
    id: "thunder-dragon",
    name: "雷龍",
    element: "electric",
    rarity: "legendary",
    description: "掌控雷電的神龍，是最強大的精靈之一。",
  },
  {
    id: "star-owl",
    name: "星空貓頭鷹",
    element: "normal",
    rarity: "common",
    description: "在星光下閃耀的神秘貓頭鷹，擁有看穿黑暗的能力。",
  },
  {
    id: "shadow-cat",
    name: "暗影貓",
    element: "normal",
    rarity: "uncommon",
    description: "來自影子世界的神秘貓咪，行動無聲無息。",
  },
  {
    id: "earth-golem",
    name: "大地石人",
    element: "grass",
    rarity: "uncommon",
    description: "由大地之力凝聚而成的岩石精靈，堅毅可靠。",
  },
  {
    id: "wind-eagle",
    name: "疾風鷹",
    element: "electric",
    rarity: "rare",
    description: "乘風而行的雄鷹，速度快如閃電。",
  },
  // 第二章 / 進化 / 扭蛋 的新精靈
  ...NEW_SPIRITS,
];

// 精靈元件映射
export const SPIRIT_COMPONENTS: Record<
  string,
  React.ComponentType<{
    size?: number;
    className?: string;
    animate?: boolean;
  }>
> = {
  "fire-slime": FireSlime,
  "water-fox": WaterFox,
  "leaf-bunny": LeafBunny,
  "thunder-mouse": ThunderMouse,
  "cloud-puff": CloudPuff,
  "rock-turtle": RockTurtle,
  "flower-sprite": FlowerSprite,
  "ice-wolf": IceWolf,
  "fire-phoenix": FirePhoenix,
  "thunder-dragon": ThunderDragon,
  "star-owl": StarOwl,
  "shadow-cat": ShadowCat,
  "earth-golem": EarthGolem,
  "wind-eagle": WindEagle,
  ...NEW_SPIRIT_COMPONENTS,
};

// 稀有度對應的顏色
export const RARITY_COLORS: Record<
  SpiritRarity,
  { bg: string; text: string; border: string }
> = {
  common: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-300",
  },
  uncommon: {
    bg: "bg-green-100",
    text: "text-green-600",
    border: "border-green-300",
  },
  rare: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-300" },
  legendary: {
    bg: "bg-amber-100",
    text: "text-amber-600",
    border: "border-amber-300",
  },
};

// 稀有度對應的中文名稱
export const RARITY_NAMES: Record<SpiritRarity, string> = {
  common: "普通",
  uncommon: "稀有",
  rare: "珍貴",
  legendary: "傳說",
};

// 元素對應的顏色
export const ELEMENT_COLORS: Record<
  SpiritElement,
  { bg: string; text: string }
> = {
  fire: { bg: "bg-red-500", text: "text-red-500" },
  water: { bg: "bg-blue-500", text: "text-blue-500" },
  grass: { bg: "bg-green-500", text: "text-green-500" },
  electric: { bg: "bg-yellow-500", text: "text-yellow-500" },
  normal: { bg: "bg-gray-400", text: "text-gray-500" },
};

// 元素對應的中文名稱與圖標
export const ELEMENT_INFO: Record<
  SpiritElement,
  { name: string; icon: string }
> = {
  fire: { name: "火", icon: "🔥" },
  water: { name: "水", icon: "💧" },
  grass: { name: "草", icon: "🌿" },
  electric: { name: "電", icon: "⚡" },
  normal: { name: "普通", icon: "⭐" },
};

// 根據 ID 獲取精靈資料
export function getSpiritById(id: string): Spirit | undefined {
  return SPIRITS.find((s) => s.id === id);
}

// 取得某精靈的進化後精靈（無則 undefined）
export function getEvolution(id: string): Spirit | undefined {
  const base = getSpiritById(id);
  if (!base?.evolvesToId) return undefined;
  return getSpiritById(base.evolvesToId);
}

// 獲取指定元素的精靈
export function getSpiritsByElement(element: SpiritElement): Spirit[] {
  return SPIRITS.filter((s) => s.element === element);
}

// 獲取指定稀有度的精靈
export function getSpiritsByRarity(rarity: SpiritRarity): Spirit[] {
  return SPIRITS.filter((s) => s.rarity === rarity);
}

// 匯出所有元件
export {
  FireSlime,
  WaterFox,
  LeafBunny,
  ThunderMouse,
  CloudPuff,
  RockTurtle,
  FlowerSprite,
  IceWolf,
  FirePhoenix,
  ThunderDragon,
  StarOwl,
  ShadowCat,
  EarthGolem,
  WindEagle,
};
