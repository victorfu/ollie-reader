import type {
  TravelScene,
  TravelTopic,
  TravelTopicGroup,
} from "../types/travelEnglish";
import { singaporeGeneralScenes } from "./scenes/singapore-general";
import { beforeDepartureScene } from "./scenes/journey-before-departure";
import { taoyuanAirportScene } from "./scenes/journey-taoyuan-airport";
import { changiArrivalScene } from "./scenes/journey-changi-arrival";
import { onThePlaneScene } from "./scenes/journey-on-the-plane";
import { goingHomeScene } from "./scenes/journey-going-home";
import { singaporeMandaiScenes } from "./scenes/singapore-mandai";
import { sentosaScenes } from "./scenes/singapore-sentosa";
import { marinaBayScene, cultureScene } from "./scenes/singapore-city-sights";

/** 從 singapore-general 取出指定場景 */
function general(id: string): TravelScene {
  const scene = singaporeGeneralScenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Missing general scene: ${id}`);
  return scene;
}

/** 把單一場景轉成一個（無小標的）分組 */
function singleGroup(scene: TravelScene): TravelTopicGroup {
  return {
    sceneId: scene.id,
    description: scene.description,
    vocabulary: scene.vocabulary,
    phrases: scene.phrases,
    dialogues: scene.dialogues,
    funFacts: scene.funFacts,
  };
}

/** 把場景轉成帶中英小標的分組（給多分組主題用） */
function labeledGroup(scene: TravelScene): TravelTopicGroup {
  return {
    sceneId: scene.id,
    label: scene.title,
    labelChinese: scene.titleChinese,
    description: scene.description,
    vocabulary: scene.vocabulary,
    phrases: scene.phrases,
    dialogues: scene.dialogues,
    funFacts: scene.funFacts,
  };
}

export const travelTopics: TravelTopic[] = [
  // ───────────────────────── 核心情境 ─────────────────────────
  {
    id: "before-departure",
    section: "core",
    stage: 1,
    stageLabel: "行前準備",
    title: "Before the Trip",
    titleChinese: "出發前準備",
    summary: "打包行李、檢查護照與登機證，認識新加坡的天氣，準備出發！",
    learningGoals: ["說出要打包的物品", "確認護照與重要文件", "聊聊新加坡的天氣"],
    mission: "和爸媽用英文完成行李檢查：說出 5 樣要帶去新加坡的東西。",
    reviewPrompt: "練習 Did you pack your...? 和 I'm so excited about our trip!",
    colorClass: "bg-violet-50",
    groups: [singleGroup(beforeDepartureScene)],
  },
  {
    id: "airport",
    section: "core",
    stage: 2,
    stageLabel: "出發與入境",
    title: "Airport & Immigration",
    titleChinese: "機場與入境",
    summary: "從桃園報到、安檢、登機門，到樟宜入境、領行李和換錢。",
    learningGoals: ["辦理登機與託運行李", "通過安檢與找登機門", "回答入境問題並領取行李"],
    mission: "完成一次從 check-in counter 到 baggage claim 的完整機場任務。",
    reviewPrompt: "用英文說出你會如何請櫃檯安排靠窗座位，並問 B5 登機門在哪裡。",
    colorClass: "bg-sky-50",
    // 出發（桃園）+ 入境（樟宜）兩個分組
    groups: [labeledGroup(taoyuanAirportScene), labeledGroup(changiArrivalScene)],
  },
  {
    id: "transport",
    section: "core",
    stage: 4,
    stageLabel: "移動城市",
    title: "Getting Around",
    titleChinese: "交通出行",
    summary: "學會搭 MRT、公車與計程車，能問路、轉乘、刷卡和估時間。",
    learningGoals: ["問目的地怎麼去", "確認要搭哪條線或哪班車", "和司機說目的地與付款方式"],
    mission: "從飯店出發，規劃一段前往 Sentosa 或 Gardens by the Bay 的路線。",
    reviewPrompt: "練習問 Which line should I take? 再補一句 How long does it take?",
    colorClass: "bg-green-50",
    groups: [singleGroup(general("transport"))],
  },
  {
    id: "food",
    section: "core",
    stage: 6,
    stageLabel: "點餐用餐",
    title: "Food & Hawker Centre",
    titleChinese: "美食與小販中心",
    summary: "在小販中心點餐、問辣不辣、點飲料、付款並歸還托盤。",
    learningGoals: ["點主餐與飲料", "調整辣度、糖度與冰量", "詢問價格與推薦餐點"],
    mission: "用英文點一份 chicken rice、一杯 iced teh，並確認是否要外帶。",
    reviewPrompt: "用 Not spicy, please. 和 Less sugar, please. 完成客製化點餐。",
    colorClass: "bg-orange-50",
    groups: [singleGroup(general("food"))],
  },
  {
    id: "hotel",
    section: "core",
    stage: 5,
    stageLabel: "入住整理",
    title: "Hotel",
    titleChinese: "飯店住宿",
    summary: "辦理入住、詢問早餐和 Wi-Fi、請求備品、反映房間問題。",
    learningGoals: ["說明訂房姓名與房型", "詢問飯店設施與服務時間", "禮貌提出房務需求"],
    mission: "完成 check-in，拿到 key card，並問清楚早餐時間與 Wi-Fi 密碼。",
    reviewPrompt: "用 I have a reservation under the name... 開頭完成入住對話。",
    colorClass: "bg-amber-50",
    groups: [singleGroup(general("hotel"))],
  },
  {
    id: "shopping",
    section: "core",
    stage: 10,
    stageLabel: "購物結帳",
    title: "Shopping",
    titleChinese: "購物",
    summary: "問價格、尺寸、顏色、折扣與付款方式，能試穿和結帳。",
    learningGoals: ["詢問價格與折扣", "要求尺寸、顏色和試穿", "完成現金或刷卡付款"],
    mission: "在 Orchard Road 買一件紀念 T-shirt，從問價到結帳全程用英文。",
    reviewPrompt: "練習 Do you have it in...? 和 Can I try this on? 兩個句型。",
    colorClass: "bg-pink-50",
    groups: [singleGroup(general("shopping"))],
  },
  {
    id: "help",
    section: "core",
    stage: 11,
    stageLabel: "旅途中求助",
    title: "Help & Emergencies",
    titleChinese: "求助與緊急",
    summary: "迷路、身體不舒服、物品遺失時，能清楚求助並說明情況。",
    learningGoals: ["開口請人協助", "說明迷路或遺失物品", "描述身體不舒服與過敏資訊"],
    mission: "演練在 Chinatown 迷路，請當地人用地圖指出回飯店的路。",
    reviewPrompt: "先說 Excuse me, can you help me? 再說明 I think I'm lost.",
    colorClass: "bg-red-50",
    groups: [singleGroup(general("help"))],
  },

  // ───────────────────────── 更多情境 ─────────────────────────
  {
    id: "plane",
    section: "more",
    stage: 3,
    stageLabel: "飛行途中",
    title: "On the Plane",
    titleChinese: "飛機上",
    summary: "找座位、繫安全帶、點機上餐、請空服員協助並準備降落。",
    learningGoals: ["詢問座位位置", "請求飲料、餐點與毯子", "理解安全提醒與降落前準備"],
    mission: "在機艙裡完成一次找座位、點餐和請求 blanket 的對話。",
    reviewPrompt: "用 May I have...? 請空服員提供水、毯子或協助。",
    colorClass: "bg-blue-50",
    groups: [singleGroup(onThePlaneScene)],
  },
  {
    id: "attractions",
    section: "more",
    stage: 7,
    stageLabel: "景點體驗",
    title: "Attractions & Fun",
    titleChinese: "景點與娛樂",
    summary: "買門票、看濱海灣燈光秀、和魚尾獅拍照，再逛牛車水與小印度。",
    learningGoals: ["購買門票與詢問表演時間", "禮貌請別人幫忙拍照", "了解寺廟與清真寺的參觀禮儀"],
    mission: "在 Gardens by the Bay 問到燈光秀時間，並請人幫全家拍一張照。",
    reviewPrompt: "練習 Could you take a photo for us? 並加上 Thank you so much.",
    colorClass: "bg-purple-50",
    // 通用景點 + 濱海灣 + 文化街區三個分組
    groups: [
      labeledGroup(general("attractions")),
      labeledGroup(marinaBayScene),
      labeledGroup(cultureScene),
    ],
  },
  {
    id: "sentosa",
    section: "more",
    stage: 8,
    stageLabel: "樂園海灘",
    title: "Sentosa & Universal Studios",
    titleChinese: "聖淘沙與環球影城",
    summary: "搭纜車上島、在環球影城玩遊樂設施和看表演，再到海灘玩水。",
    learningGoals: ["詢問身高限制與排隊時間", "問表演與遊行的時間", "購買纜車與斜坡滑車的票"],
    mission: "在環球影城完成問身高限制、排隊時間和表演時間三段式任務。",
    reviewPrompt: "練習 Am I tall enough for this ride? 和 How long is the wait?",
    colorClass: "bg-cyan-50",
    // 環球影城 + 聖淘沙島兩個分組
    groups: sentosaScenes.map(labeledGroup),
  },
  {
    id: "mandai",
    section: "more",
    stage: 9,
    stageLabel: "野生探索",
    title: "Mandai Wildlife",
    titleChinese: "動物園 Mandai",
    summary: "在 Mandai 各園區買票、問餵食時間、看表演、搭遊園車與觀察動物。",
    learningGoals: ["詢問餵食和表演時程", "描述動物行為與棲地", "參與導覽、遊園車和親子體驗"],
    mission: "選一個園區完成 ticket、schedule、observation 三段式練習。",
    reviewPrompt: "用 What time is...? 問餵食時間，再用 Look! The... is... 觀察動物。",
    colorClass: "bg-emerald-50",
    // 每個園區一個分組（新加坡動物園 / 夜間動物園 / 河川生態園 / 飛禽公園 / 雨林）
    groups: singaporeMandaiScenes.map(labeledGroup),
  },
  {
    id: "going-home",
    section: "more",
    stage: 12,
    stageLabel: "回程道別",
    title: "Going Home",
    titleChinese: "回家囉",
    summary: "在樟宜機場辦退稅、買最後的伴手禮，和新加坡說再見。",
    learningGoals: ["詢問退稅櫃檯並出示收據", "確認回程登機門與時間", "用英文分享旅行回憶"],
    mission: "完成一次退稅對話，再用英文說出旅程中最喜歡的三件事。",
    reviewPrompt: "用 I had a wonderful time! 和 I can't wait to come back! 說再見。",
    colorClass: "bg-rose-50",
    groups: [singleGroup(goingHomeScene)],
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
  // 出發前 / 回程
  packing: "打包行李",
  planning: "行程規劃",
  knowledge: "小知識",
  departure: "準備出發",
  "tax refund": "退稅",
  farewell: "道別",
  // 樂園 / 戶外
  rides: "遊樂設施",
  height: "身高限制",
  "cable car": "搭纜車",
  beach: "海灘",
  viewpoint: "觀景拍照",
  weather: "天氣應對",
  // 文化街區
  etiquette: "參觀禮儀",
  culture: "文化體驗",
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
