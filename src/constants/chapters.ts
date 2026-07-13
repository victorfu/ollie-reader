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
    name: "第一章 · 精靈草原",
    subtitle: "從草原一路挑戰到風暴之巔",
    firstStageIndex: 0,
  },
  {
    id: "ch2",
    name: "第二章 · 雲頂星夢國",
    subtitle: "棉花糖與星光的甜蜜國度",
    firstStageIndex: 13,
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
