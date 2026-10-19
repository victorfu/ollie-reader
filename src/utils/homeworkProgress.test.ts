import { describe, expect, it } from "vitest";
import type { Homework, HomeworkWord, HomeworkWordProgress } from "../types/wordPractice";
import {
  MAX_ATTEMPTS,
  SPELL_TARGET,
  STEP_ORDER,
  applyExerciseAnswer,
  emptyProgress,
  gradeTest,
  isStepComplete,
  isTestUnlocked,
} from "./homeworkProgress";

type HomeworkLike = Pick<Homework, "words" | "progress">;

const apple: HomeworkWord = {
  key: "apple",
  vocabularyId: "v-apple",
  word: "apple",
  definitions: [{ partOfSpeech: "noun", definition: "a round fruit" }],
  sentence: "I ate an apple.",
  cloze: { text: "I ate an ____.", answer: "apple" },
  cefr: { level: "A1", source: "list" },
};

const lookForwardTo: HomeworkWord = {
  key: "look forward to",
  vocabularyId: "v-look-forward-to",
  word: "look forward to",
  definitions: [{ partOfSpeech: "phrasal verb", definition: "to wait for something happily" }],
  sentence: null,
  cloze: null,
  cefr: { level: "B1", source: "list" },
};

const donePractice = { attempts: 1, correct: true, done: true };

/** Progress with every step before the test finished for both words. */
function finishedProgress(): HomeworkWordProgress[] {
  return [
    {
      learned: true,
      spellCorrect: SPELL_TARGET,
      fill: donePractice,
      define: donePractice,
      sentence: { text: "I like an apple.", feedback: null },
      testAnswer: null,
    },
    {
      learned: true,
      spellCorrect: SPELL_TARGET,
      fill: { attempts: 0, correct: false, done: false },
      define: donePractice,
      sentence: { text: "I look forward to it.", feedback: null },
      testAnswer: null,
    },
  ];
}

function homework(progress: HomeworkWordProgress[] = emptyProgress(2)): HomeworkLike {
  return { words: [apple, lookForwardTo], progress };
}

describe("constants", () => {
  it("defines the step order and limits", () => {
    expect(STEP_ORDER).toEqual(["learn", "spell", "fill", "define", "sentence", "test"]);
    expect(SPELL_TARGET).toBe(3);
    expect(MAX_ATTEMPTS).toBe(2);
  });
});

describe("emptyProgress", () => {
  it("creates one untouched entry per word", () => {
    const untouched = {
      learned: false,
      spellCorrect: 0,
      fill: { attempts: 0, correct: false, done: false },
      define: { attempts: 0, correct: false, done: false },
      sentence: null,
      testAnswer: null,
    };
    expect(emptyProgress(2)).toEqual([untouched, untouched]);
    expect(emptyProgress(0)).toEqual([]);
  });

  it("does not share objects between entries", () => {
    const [first, second] = emptyProgress(2);
    expect(first).not.toBe(second);
    expect(first.fill).not.toBe(second.fill);
    expect(first.define).not.toBe(second.define);
  });
});

describe("applyExerciseAnswer", () => {
  const fresh = { attempts: 0, correct: false, done: false };

  it("keeps the exercise open after a first wrong answer", () => {
    expect(applyExerciseAnswer(fresh, false)).toEqual({ attempts: 1, correct: false, done: false });
  });

  it("finishes the exercise after a second wrong answer", () => {
    const afterFirst = applyExerciseAnswer(fresh, false);
    expect(applyExerciseAnswer(afterFirst, false)).toEqual({
      attempts: 2,
      correct: false,
      done: true,
    });
  });

  it("finishes the exercise on a correct first answer", () => {
    expect(applyExerciseAnswer(fresh, true)).toEqual({ attempts: 1, correct: true, done: true });
  });

  it("finishes the exercise on a correct second answer", () => {
    const afterFirst = applyExerciseAnswer(fresh, false);
    expect(applyExerciseAnswer(afterFirst, true)).toEqual({
      attempts: 2,
      correct: true,
      done: true,
    });
  });

  it("ignores answers once the exercise is done", () => {
    const done = { attempts: 1, correct: true, done: true };
    expect(applyExerciseAnswer(done, false)).toEqual(done);
    const failed = { attempts: 2, correct: false, done: true };
    expect(applyExerciseAnswer(failed, true)).toEqual(failed);
  });

  it("does not mutate its input", () => {
    const input = { attempts: 0, correct: false, done: false };
    applyExerciseAnswer(input, true);
    expect(input).toEqual({ attempts: 0, correct: false, done: false });
  });
});

describe("isStepComplete", () => {
  it("is false for every step on a fresh homework", () => {
    const hw = homework();
    expect(isStepComplete(hw, "learn")).toBe(false);
    expect(isStepComplete(hw, "spell")).toBe(false);
    expect(isStepComplete(hw, "fill")).toBe(false);
    expect(isStepComplete(hw, "define")).toBe(false);
    expect(isStepComplete(hw, "sentence")).toBe(false);
    expect(isStepComplete(hw, "test")).toBe(false);
  });

  it("completes learn only when every word is learned", () => {
    const progress = emptyProgress(2);
    progress[0].learned = true;
    expect(isStepComplete(homework(progress), "learn")).toBe(false);
    progress[1].learned = true;
    expect(isStepComplete(homework(progress), "learn")).toBe(true);
  });

  it("completes spell only when every word is spelled correctly SPELL_TARGET times", () => {
    const progress = emptyProgress(2);
    progress[0].spellCorrect = SPELL_TARGET;
    progress[1].spellCorrect = SPELL_TARGET - 1;
    expect(isStepComplete(homework(progress), "spell")).toBe(false);
    progress[1].spellCorrect = SPELL_TARGET;
    expect(isStepComplete(homework(progress), "spell")).toBe(true);
  });

  it("completes fill by looking only at words that have a cloze", () => {
    const progress = emptyProgress(2);
    expect(isStepComplete(homework(progress), "fill")).toBe(false);
    progress[0].fill = { attempts: 2, correct: false, done: true };
    expect(isStepComplete(homework(progress), "fill")).toBe(true);
  });

  it("completes fill when no word has a cloze", () => {
    const hw: HomeworkLike = { words: [lookForwardTo], progress: emptyProgress(1) };
    expect(isStepComplete(hw, "fill")).toBe(true);
  });

  it("completes define only when every word's definition exercise is done", () => {
    const progress = emptyProgress(2);
    progress[0].define = donePractice;
    expect(isStepComplete(homework(progress), "define")).toBe(false);
    progress[1].define = { attempts: 2, correct: false, done: true };
    expect(isStepComplete(homework(progress), "define")).toBe(true);
  });

  it("completes sentence only when every sentence uses its word", () => {
    const progress = emptyProgress(2);
    progress[0].sentence = { text: "I like it.", feedback: null };
    progress[1].sentence = { text: "I look forward to it.", feedback: null };
    expect(isStepComplete(homework(progress), "sentence")).toBe(false);
    progress[0].sentence = { text: "I ate an apple.", feedback: null };
    expect(isStepComplete(homework(progress), "sentence")).toBe(true);
  });

  it("does not complete sentence while a word has no sentence yet", () => {
    const progress = emptyProgress(2);
    progress[1].sentence = { text: "I look forward to it.", feedback: null };
    expect(isStepComplete(homework(progress), "sentence")).toBe(false);
  });

  it("completes test only when every word has an answer", () => {
    const progress = emptyProgress(2);
    progress[0].testAnswer = "apple";
    expect(isStepComplete(homework(progress), "test")).toBe(false);
    progress[1].testAnswer = "";
    expect(isStepComplete(homework(progress), "test")).toBe(true);
  });
});

describe("isTestUnlocked", () => {
  it("stays locked until learn, spell, fill, define and sentence are all complete", () => {
    expect(isTestUnlocked(homework())).toBe(false);

    const base = finishedProgress();
    // The second word has no cloze, so its unfinished fill does not matter.
    expect(isTestUnlocked(homework(base))).toBe(true);

    const notLearned = finishedProgress();
    notLearned[0].learned = false;
    expect(isTestUnlocked(homework(notLearned))).toBe(false);

    const notSpelled = finishedProgress();
    notSpelled[1].spellCorrect = SPELL_TARGET - 1;
    expect(isTestUnlocked(homework(notSpelled))).toBe(false);

    const notFilled = finishedProgress();
    notFilled[0].fill = { attempts: 1, correct: false, done: false };
    expect(isTestUnlocked(homework(notFilled))).toBe(false);

    const notDefined = finishedProgress();
    notDefined[1].define = { attempts: 0, correct: false, done: false };
    expect(isTestUnlocked(homework(notDefined))).toBe(false);

    const noSentence = finishedProgress();
    noSentence[0].sentence = { text: "I like it.", feedback: null };
    expect(isTestUnlocked(homework(noSentence))).toBe(false);
  });

  it("does not require the test itself to be finished", () => {
    const hw = homework(finishedProgress());
    expect(isStepComplete(hw, "test")).toBe(false);
    expect(isTestUnlocked(hw)).toBe(true);
  });
});

describe("gradeTest", () => {
  it("splits correct and missed words in word order", () => {
    const progress = finishedProgress();
    progress[0].testAnswer = "Apple ";
    progress[1].testAnswer = "look forward";
    expect(gradeTest(homework(progress))).toEqual({
      correctKeys: ["apple"],
      missedKeys: ["look forward to"],
      correctCount: 1,
      total: 2,
    });
  });

  it("counts every word correct when all answers match", () => {
    const progress = finishedProgress();
    progress[0].testAnswer = "APPLE";
    progress[1].testAnswer = "look   forward to";
    expect(gradeTest(homework(progress))).toEqual({
      correctKeys: ["apple", "look forward to"],
      missedKeys: [],
      correctCount: 2,
      total: 2,
    });
  });

  it("counts a blank answer as missed", () => {
    const progress = finishedProgress();
    progress[0].testAnswer = "";
    progress[1].testAnswer = "look forward to";
    expect(gradeTest(homework(progress))).toEqual({
      correctKeys: ["look forward to"],
      missedKeys: ["apple"],
      correctCount: 1,
      total: 2,
    });
  });

  it("throws when any word has no test answer", () => {
    const progress = finishedProgress();
    progress[0].testAnswer = "apple";
    expect(() => gradeTest(homework(progress))).toThrow();
  });

  it("throws when progress is not aligned with words", () => {
    const progress = finishedProgress().slice(0, 1);
    progress[0].testAnswer = "apple";
    expect(() => gradeTest(homework(progress))).toThrow();
  });
});
