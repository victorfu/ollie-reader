/**
 * Progress and grading rules for a Word Practice homework.
 *
 * A homework walks through six steps. `progress` is index-aligned with
 * `words`; these helpers read it to decide when a step is finished, when the
 * spelling test unlocks, and how the finished test scores.
 */
import type {
  ExerciseProgress,
  Homework,
  HomeworkResult,
  HomeworkWordProgress,
} from "../types/wordPractice";
import { isAnswerCorrect } from "./answerMatch";
import { sentenceUsesWord } from "./wordForms";

export type StepId = "learn" | "spell" | "fill" | "define" | "sentence" | "test";

export const STEP_ORDER: readonly StepId[] = [
  "learn",
  "spell",
  "fill",
  "define",
  "sentence",
  "test",
];

/** Correct spellings a learner must type for each word in the spelling step. */
export const SPELL_TARGET = 3;

/** Chances a learner gets per word in the fill and define exercises. */
export const MAX_ATTEMPTS = 2;

type HomeworkSteps = Pick<Homework, "words" | "progress">;

function emptyExercise(): ExerciseProgress {
  return { attempts: 0, correct: false, done: false };
}

export function emptyProgress(count: number): HomeworkWordProgress[] {
  return Array.from({ length: count }, () => ({
    learned: false,
    spellCorrect: 0,
    fill: emptyExercise(),
    define: emptyExercise(),
    sentence: null,
    testAnswer: null,
  }));
}

/**
 * Records one answer. The exercise is done once the answer is correct or the
 * learner has used all `MAX_ATTEMPTS`; a finished exercise ignores further
 * answers.
 */
export function applyExerciseAnswer(p: ExerciseProgress, correct: boolean): ExerciseProgress {
  if (p.done) return p;
  const attempts = p.attempts + 1;
  return { attempts, correct, done: correct || attempts >= MAX_ATTEMPTS };
}

export function isStepComplete(hw: HomeworkSteps, step: StepId): boolean {
  const { words, progress } = hw;
  switch (step) {
    case "learn":
      return progress.every((p) => p.learned);
    case "spell":
      return progress.every((p) => p.spellCorrect >= SPELL_TARGET);
    case "fill":
      // Words without a cloze have no fill exercise.
      return words.every((word, i) => word.cloze === null || progress[i].fill.done);
    case "define":
      return progress.every((p) => p.define.done);
    case "sentence":
      return words.every((word, i) => {
        const sentence = progress[i].sentence;
        return sentence !== null && sentenceUsesWord(sentence.text, word.word);
      });
    case "test":
      return progress.every((p) => p.testAnswer !== null);
  }
}

/** The spelling test opens once every step before it is complete. */
export function isTestUnlocked(hw: HomeworkSteps): boolean {
  return STEP_ORDER.filter((step) => step !== "test").every((step) => isStepComplete(hw, step));
}

/**
 * Scores the spelling test. Throws if `progress` is not aligned with `words`
 * or any word is still unanswered, since both mean the caller graded too soon.
 */
export function gradeTest(hw: HomeworkSteps): HomeworkResult {
  const { words, progress } = hw;
  if (words.length !== progress.length) {
    throw new Error(
      `Cannot grade test: ${words.length} words but ${progress.length} progress entries`,
    );
  }

  const correctKeys: string[] = [];
  const missedKeys: string[] = [];
  words.forEach((word, i) => {
    const answer = progress[i].testAnswer;
    if (answer === null) {
      throw new Error(`Cannot grade test: "${word.word}" has no answer`);
    }
    (isAnswerCorrect(answer, word.word) ? correctKeys : missedKeys).push(word.key);
  });

  return {
    correctKeys,
    missedKeys,
    correctCount: correctKeys.length,
    total: words.length,
  };
}
