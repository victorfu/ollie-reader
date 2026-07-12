export type ExamSubject = "chinese" | "math";

export interface ExamQuestion {
  /** 全卷唯一 id,依整卷順序零填充:"chi-001".."chi-100"、"math-001".."math-100" */
  id: string;
  /**
   * 原卷印刷題號(對照紙本用)。國語卷每個大題題號從 1 重新起算;
   * 數學卷只有一個大題,題號為 1..100。
   */
  number: number;
  sectionId: string;
  /** 題幹。可含分數標記 {3/8}、帶分數 2{51/100} 與換行 \n。 */
  text: string;
  /**
   * 選項,固定為原卷順序(絕不打亂——有「以上皆是」等位置相關選項)。
   * 圖片已包含選項時(imageContainsOptions)省略,UI 改渲染 ①②③④ 按鈕。
   */
  options?: readonly [string, string, string, string];
  /** 正確選項索引(0 起算,對應原卷 ①②③④)。 */
  answerIndex: 0 | 1 | 2 | 3;
  /** 解析(國語卷多數題目有;數學卷無)。 */
  explanation?: string;
  /** 圖檔名,如 "math-q25.png",對應 /exams/images/ 下的裁圖。 */
  image?: string;
  /** 題目附圖的等價文字描述。 */
  imageAlt?: string;
  /** true 表示裁圖已包含印刷選項,按鈕只顯示 ①②③④。 */
  imageContainsOptions?: boolean;
  /** 圖片內選項的文字替代，順序對應 ①②③④。 */
  imageOptionLabels?: readonly string[];
  /** imageContainsOptions 題的選項數(預設 4;數學第 25 題只有 2 個)。 */
  optionCount?: 2 | 3 | 4;
}

export interface ExamSection {
  id: string;
  /** 大題標題,如「一、選擇題」或「第一部分」。 */
  title: string;
  /** 補充說明,如「第 1~25 題」。 */
  subtitle?: string;
  questions: readonly ExamQuestion[];
}

export interface ExamPaper {
  subject: ExamSubject;
  title: string;
  /** 題目卷 PDF 路徑(public/ 下,未編碼;渲染時 encodeURI)。 */
  questionPdf: string;
  /** 解析卷/簡答卷 PDF 路徑。 */
  answerPdf: string;
  answerPdfLabel: string;
  sections: readonly ExamSection[];
  totalQuestions: number;
}

/** 練習範圍:單一大題 id 或整卷 "full"。 */
export type ExamScopeId = string;

export const FULL_SCOPE_ID = "full";

export interface ExamScope {
  id: ExamScopeId;
  title: string;
  subtitle?: string;
  questionCount: number;
}

export type ExamSessionMode = "normal" | "retry";

export type ExamQuizPhase = "idle" | "active" | "finished";

export interface ExamQuizSession {
  subject: ExamSubject;
  scopeId: ExamScopeId;
  scopeLabel: string;
  mode: ExamSessionMode;
  /** 依原卷順序,永不重排。 */
  questions: readonly ExamQuestion[];
  currentIndex: number;
  /** 每題已選的選項索引;null = 尚未作答。 */
  answers: (number | null)[];
  /** 目前題目是否已作答(回饋顯示中)。 */
  isAnswered: boolean;
  lastAnswerCorrect: boolean | null;
}

export interface ExamQuizResult {
  score: number;
  total: number;
  wrong: readonly ExamQuestion[];
  /** 錯題當下所選的選項索引,與 wrong 同序。 */
  wrongChosen: readonly number[];
  mode: ExamSessionMode;
  isNewBest: boolean;
}

/** localStorage 中每個 (subject, scopeId) 的紀錄。 */
export interface ExamScopeProgress {
  /** normal 模式的最佳成績(retry 子集分母不同,不納入)。 */
  bestScore: number;
  bestTotal: number;
  lastScore: number;
  lastTotal: number;
  /** 最近一次練習(任何模式)的錯題 id。 */
  lastWrongIds: string[];
  updatedAt: number;
}
