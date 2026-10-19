export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export interface CefrInfo {
  level: CefrLevel;
  source: "list" | "ai";
}

export interface WordPracticeWordState {
  learnedAt?: number;
  missCount: number;
  lastMissedAt?: number;
}
export interface WordPracticeState {
  activeHomeworkId: string | null;
  words: Record<string, WordPracticeWordState>; // key = practiceKey(word)
  cefrEstimates: Record<string, CefrLevel>; // key = practiceKey(word)
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
  definitions: { partOfSpeech: string; definition: string }[]; // English only
  sentence: string | null;
  cloze: Cloze | null;
  cefr: CefrInfo | null;
}
export interface ExerciseProgress {
  attempts: number;
  correct: boolean;
  done: boolean;
}
export interface SentenceFeedback {
  usedCorrectly: boolean;
  feedback: string;
  suggestion?: string;
}
export interface HomeworkWordProgress {
  learned: boolean;
  spellCorrect: number;
  fill: ExerciseProgress;
  define: ExerciseProgress;
  sentence: { text: string; feedback: SentenceFeedback | null } | null;
  testAnswer: string | null;
}
export interface HomeworkOptions {
  wordCount: number;
  startLevel: CefrLevel;
}
export interface HomeworkResult {
  correctKeys: string[];
  missedKeys: string[];
  correctCount: number;
  total: number;
}
export type HomeworkStatus = "active" | "completed" | "abandoned";
export interface Homework {
  id: string;
  status: HomeworkStatus;
  createdAt: number;
  completedAt?: number;
  options: HomeworkOptions;
  words: HomeworkWord[];
  progress: HomeworkWordProgress[]; // same order as words
  result?: HomeworkResult;
}
