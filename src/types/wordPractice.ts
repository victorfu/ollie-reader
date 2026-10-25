import type { HomeworkReward, HomeworkStreak } from "../services/economyService";
import type { InflectionKind } from "../utils/inflection";

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
  /** The day of the last handed-in homework and the run of days in a row. */
  homeworkStreak?: HomeworkStreak;
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
  /**
   * Set when the saved word was an inflected form ("ran"): `word` is then the
   * base form ("run"), taught first, and this is the saved form, taught after it.
   */
  inflection?: { form: string; kind: InflectionKind };
}

export type PageSection = "look" | "copy" | "recall" | "form" | "sentence" | "done";

export interface WordPageProgress {
  section: PageSection;
  copies: number;
  /** Only in homework written while the page still had a phrase step. */
  phrase?: string | null;
  sentence: string | null;
}

/** Gemini's review of one sentence Ollie wrote: a Chinese comment, and a fix when needed. */
export interface SentenceReview {
  key: string;
  ok: boolean;
  comment: string;
  corrected?: string;
}

export interface HomeworkReview {
  reviewedAt: number;
  items: SentenceReview[];
}

export interface DictationItem {
  key: string;
  source: "new" | "review";
  answer: string | null;
  skipped: boolean;
  /** Asks for the word's inflected form instead of its base form. */
  form?: true;
}

export interface HomeworkProgress {
  pages: WordPageProgress[];
  dictation: DictationItem[];
  corrections: Record<string, number>;
}

/** The keys are dictation item ids (`dictationId`): a form item has its own. */
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
  /** Gemini's review of the sentences, added after the homework is handed in. */
  review?: HomeworkReview;
  /** The coins paid when the homework was handed in. */
  reward?: HomeworkReward;
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
