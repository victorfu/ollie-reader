/** 目的地 — v2 擴充用 */
export interface TravelDestination {
  id: string;
  name: string;
  nameChinese: string;
  emoji: string;
  scenes: TravelScene[];
}

/** 場景 */
export interface TravelScene {
  id: string;
  title: string;
  titleChinese: string;
  emoji: string;
  description: string;
  colorClass: string;
  vocabulary: TravelVocab[];
  phrases: TravelPhrase[];
  dialogues: TravelDialogue[];
}

/** 單字 */
export interface TravelVocab {
  word: string;
  chinese: string;
  emoji: string;
  phonetic?: string;
  example?: string;
}

/** 片語 / 句型 */
export interface TravelPhrase {
  id: string;
  english: string;
  chinese: string;
  situation?: string;
}

/** 對話 */
export interface TravelDialogue {
  id: string;
  title: string;
  titleChinese: string;
  description: string;
  lines: DialogueLine[];
}

/** 對話中的一句 */
export interface DialogueLine {
  speaker: "A" | "B";
  role: string;
  english: string;
  chinese: string;
}

/** 聽說練習用 */
export interface PracticeItem {
  english: string;
  chinese: string;
  hint?: string;
}

/** 場景分組 */
export interface SceneSection {
  id: string;
  title: string;
  titleChinese: string;
  emoji: string;
  scenes: TravelScene[];
}

/** 分頁 */
export type SceneTab = "phrases" | "dialogues" | "practice";
