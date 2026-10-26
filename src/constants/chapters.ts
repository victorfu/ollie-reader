export interface Chapter {
  id: string;
  name: string; // 章節標題（HUD / 分隔線）
  subtitle: string;
  firstStageIndex: number; // STAGES 中該章第一關的 index
}

// 章節定義（firstStageIndex 對應 gameProgressService 的 STAGES 順序）
export const CHAPTERS: Chapter[] = [
  {
    id: "ch1",
    name: "第一章 · 陽光草原",
    subtitle: "從草原一路挑戰到風暴之巔",
    firstStageIndex: 0,
  },
  {
    id: "ch2",
    name: "第二章 · 雲頂星夢國",
    subtitle: "棉花糖與星光的甜蜜國度",
    firstStageIndex: 13,
  },
  {
    id: "ch3",
    name: "第三章 · 珊瑚海底王國",
    subtitle: "潛進閃閃發光的海底世界",
    firstStageIndex: 23,
  },
  {
    id: "ch4",
    name: "第四章 · 魔法星辰學院",
    subtitle: "在會說話的圖書館學新咒語",
    firstStageIndex: 33,
  },
  {
    id: "ch5",
    name: "第五章 · 極光冰雪王國",
    subtitle: "滑過冰晶與極光的雪白國度",
    firstStageIndex: 43,
  },
  {
    id: "ch6",
    name: "第六章 · 恐龍火山島",
    subtitle: "穿越叢林、化石與滾燙岩漿",
    firstStageIndex: 53,
  },
  {
    id: "ch7",
    name: "第七章 · 銀河終點站",
    subtitle: "飛向宇宙盡頭的最終冒險",
    firstStageIndex: 63,
  },
];

/** 依關卡 index 取得所屬章節 */
export function getChapterForStageIndex(index: number): Chapter {
  let current = CHAPTERS[0];
  for (const chapter of CHAPTERS) {
    if (index >= chapter.firstStageIndex) current = chapter;
  }
  return current;
}
