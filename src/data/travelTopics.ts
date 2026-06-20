import type {
  TravelScene,
  TravelTopic,
  TravelTopicGroup,
} from "../types/travelEnglish";
import { singaporeGeneralScenes } from "./scenes/singapore-general";
import { taoyuanAirportScene } from "./scenes/journey-taoyuan-airport";
import { changiArrivalScene } from "./scenes/journey-changi-arrival";
import { onThePlaneScene } from "./scenes/journey-on-the-plane";
import { singaporeMandaiScenes } from "./scenes/singapore-mandai";

/** 從 singapore-general 取出指定場景 */
function general(id: string): TravelScene {
  const scene = singaporeGeneralScenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Missing general scene: ${id}`);
  return scene;
}

/** 把單一場景轉成一個（無小標的）分組 */
function singleGroup(scene: TravelScene): TravelTopicGroup {
  return { vocabulary: scene.vocabulary, phrases: scene.phrases };
}

/** 把場景轉成帶中英小標的分組（給多分組主題用） */
function labeledGroup(scene: TravelScene): TravelTopicGroup {
  return {
    emoji: scene.emoji,
    label: scene.title,
    labelChinese: scene.titleChinese,
    vocabulary: scene.vocabulary,
    phrases: scene.phrases,
  };
}

export const travelTopics: TravelTopic[] = [
  // ───────────────────────── 核心情境 ─────────────────────────
  {
    id: "airport",
    section: "core",
    emoji: "🛂",
    title: "Airport & Immigration",
    titleChinese: "機場與入境",
    colorClass: "bg-sky-50",
    // 出發（桃園）+ 入境（樟宜）兩個分組
    groups: [labeledGroup(taoyuanAirportScene), labeledGroup(changiArrivalScene)],
  },
  {
    id: "transport",
    section: "core",
    emoji: "🚇",
    title: "Getting Around",
    titleChinese: "交通出行",
    colorClass: "bg-green-50",
    groups: [singleGroup(general("transport"))],
  },
  {
    id: "food",
    section: "core",
    emoji: "🍜",
    title: "Food & Hawker Centre",
    titleChinese: "美食與小販中心",
    colorClass: "bg-orange-50",
    groups: [singleGroup(general("food"))],
  },
  {
    id: "hotel",
    section: "core",
    emoji: "🏨",
    title: "Hotel",
    titleChinese: "飯店住宿",
    colorClass: "bg-amber-50",
    groups: [singleGroup(general("hotel"))],
  },
  {
    id: "shopping",
    section: "core",
    emoji: "🛍️",
    title: "Shopping",
    titleChinese: "購物",
    colorClass: "bg-pink-50",
    groups: [singleGroup(general("shopping"))],
  },
  {
    id: "help",
    section: "core",
    emoji: "🆘",
    title: "Help & Emergencies",
    titleChinese: "求助與緊急",
    colorClass: "bg-red-50",
    groups: [singleGroup(general("help"))],
  },

  // ───────────────────────── 更多情境 ─────────────────────────
  {
    id: "plane",
    section: "more",
    emoji: "✈️",
    title: "On the Plane",
    titleChinese: "飛機上",
    colorClass: "bg-blue-50",
    groups: [singleGroup(onThePlaneScene)],
  },
  {
    id: "attractions",
    section: "more",
    emoji: "🎢",
    title: "Attractions & Fun",
    titleChinese: "景點與娛樂",
    colorClass: "bg-purple-50",
    groups: [singleGroup(general("attractions"))],
  },
  {
    id: "mandai",
    section: "more",
    emoji: "🦁",
    title: "Mandai Wildlife",
    titleChinese: "動物園 Mandai",
    colorClass: "bg-emerald-50",
    // 每個園區一個分組（新加坡動物園 / 夜間動物園 / 河川生態園 / 飛禽公園 / 雨林）
    groups: singaporeMandaiScenes.map(labeledGroup),
  },
];

/**
 * 把句子的 situation 標籤轉成中文「使用時機」說明。
 * 找不到對應時回傳「一般」。
 */
const SITUATION_LABELS: Record<string, string> = {
  // 通用
  general: "一般",
  directions: "問路",
  inquiry: "詢問",
  observation: "觀察動物",
  facilities: "設施位置",
  photos: "拍照",
  shows: "看表演",
  schedule: "活動時間",
  hours: "開放時間",
  tickets: "買票",
  // 機場 / 飛機
  "check-in": "報到 / 入住",
  luggage: "行李託運",
  navigation: "找路 / 方向",
  security: "安檢",
  boarding: "登機",
  immigration: "入境查驗",
  customs: "海關申報",
  baggage: "領行李",
  money: "換錢",
  transport: "前往市區",
  "finding seat": "找座位",
  meal: "機上餐點",
  comfort: "機上需求",
  bathroom: "上廁所",
  time: "詢問時間",
  safety: "安全須知",
  "arrival card": "填入境卡",
  // 飯店
  amenities: "設施服務",
  "room service": "客房服務",
  problems: "反映問題",
  checkout: "退房 / 結帳",
  // 餐飲
  ordering: "點餐",
  paying: "付款",
  drinks: "點飲料",
  "after eating": "用餐後",
  // 交通
  MRT: "搭地鐵",
  bus: "搭公車",
  taxi: "搭計程車",
  // 購物
  price: "詢問價格",
  size: "詢問尺寸",
  fitting: "試穿",
  browsing: "逛逛挑選",
  buying: "購買",
  payment: "付款",
  bargaining: "殺價",
  shopping: "購物",
  // 景點 / 娛樂
  queue: "排隊",
  "theme park": "遊樂設施",
  // 求助
  lost: "迷路",
  health: "身體不適",
  "lost items": "遺失物品",
  emergency: "緊急狀況",
  // 動物園
  feeding: "餵食動物",
  tram: "搭遊園車",
  trails: "走步道",
  environment: "環境",
  feelings: "心情感受",
  boat: "搭船",
  concern: "擔心疑慮",
  excitement: "興奮時刻",
  activities: "體驗活動",
};

export function situationLabel(situation?: string): string {
  if (!situation) return "一般";
  return SITUATION_LABELS[situation] ?? "一般";
}
