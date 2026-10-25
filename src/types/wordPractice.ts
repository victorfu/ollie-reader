export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export interface CefrInfo {
  level: CefrLevel;
  source: "list" | "ai";
}

export type HomeworkStatus = "active" | "completed" | "abandoned";

/** 0 = not yet written correctly; 1-5 = index into the review intervals. */
export type ReviewStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface WordPracticeWordState {
  stage: ReviewStage;
  dueAt?: number; // ms; only when stage >= 1
  needsPractice?: boolean; // missed in dictation, not yet written correctly again
  lastResult?: "correct" | "wrong";
  sentence?: string; // the example sentence from an earlier homework snapshot
  learnedAt?: number;
  missCount: number;
  lastMissedAt?: number; // learnedAt, missCount and lastMissedAt are records only
}

export interface PracticeSettings {
  newWordCount: number;
  reviewLimit: number;
  startLevel: CefrLevel;
}

export interface WordPracticeState {
  schemaVersion: 2;
  activeHomeworkId: string | null;
  words: Record<string, WordPracticeWordState>; // key = practiceKey(word)
  cefrEstimates: Record<string, CefrLevel>; // key = practiceKey(word)
  settings: PracticeSettings;
}

export interface Cloze {
  text: string;
  /** The first blank as written in the sentence; this is the one shown as the answer. */
  answer: string;
  /**
   * Every different form that is blanked, when the sentence blanks more than
   * one ("Dogs love to run, and my dog runs fast."). Each one is accepted.
   * Absent when there is a single form, and in homework stored before this existed.
   */
  answers?: string[];
}
export interface HomeworkWord {
  key: string; // practiceKey(word)
  vocabularyId: string;
  word: string;
  emoji?: string;
  definitions: {
    partOfSpeech: string;
    definition: string;
    definitionChinese?: string;
  }[];
  sentence: string | null;
  cefr: CefrInfo | null;
}

export type PageSection =
  | "look"
  | "copy"
  | "recall"
  | "cloze"
  | "sentence"
  | "done";

export interface WordPageProgress {
  section: PageSection;
  copies: number;
  /** Only in homework written before the phrase step was replaced by the cloze. */
  phrase?: string | null;
  sentence: string | null;
}

export interface DictationItem {
  key: string;
  source: "new" | "review";
  answer: string | null;
  skipped: boolean;
}

export interface HomeworkProgress {
  pages: WordPageProgress[];
  dictation: DictationItem[];
  corrections: Record<string, number>;
}

export interface DictationResult {
  correctKeys: string[];
  wrongKeys: string[];
  skippedKeys: string[];
  correctCount: number;
  total: number;
}

export interface Homework extends HomeworkProgress {
  version: 2;
  id: string;
  status: HomeworkStatus;
  createdAt: number;
  completedAt?: number;
  newWords: HomeworkWord[]; // same order as pages
  reviewWords: HomeworkWord[];
  result?: DictationResult;
}

/** Old completed homework, kept only to show its date and score in the history. */
export interface LegacyHomework {
  id: string;
  status: HomeworkStatus;
  createdAt: number;
  completedAt?: number;
  words: { key: string; word: string }[];
  result?: { correctCount: number; total: number };
}

export type HistoryHomework = Homework | LegacyHomework;
