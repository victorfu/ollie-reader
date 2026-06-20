/** 目的地 — v2 擴充用 */
export interface TravelDestination {
  id: string;
  name: string;
  nameChinese: string;
  emoji: string;
  scenes: TravelScene[];
}

/** 趣味小知識 */
export interface FunFact {
  emoji: string;
  english: string;
  chinese: string;
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
  funFacts?: FunFact[];
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

/** 旅遊主題的子分組（一個主題底下可有多個分組，例如機場分「出發 / 入境」、動物園分各園區） */
export interface TravelTopicGroup {
  emoji?: string;
  /** 英文小標（多分組時顯示） */
  label?: string;
  /** 中文小標（多分組時顯示） */
  labelChinese?: string;
  vocabulary: TravelVocab[];
  phrases: TravelPhrase[];
}

/** 旅遊主題（重新設計後的精簡版資料模型，分情境呈現必學單字與實用句子） */
export interface TravelTopic {
  id: string;
  /** 首頁分區：核心情境 / 更多情境 */
  section: "core" | "more";
  emoji: string;
  /** 英文副標 */
  title: string;
  /** 中文主標 */
  titleChinese: string;
  /** 卡片底色，沿用來源場景的 colorClass */
  colorClass: string;
  groups: TravelTopicGroup[];
}
