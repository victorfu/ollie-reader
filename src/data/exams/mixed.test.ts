import { describe, expect, it } from "vitest";
import { EXAM_PAPERS, getAllQuestions } from "./index";
import {
  MIXED_MIN_QUESTIONS,
  MIXED_POOL_TOTAL,
  MIXED_SCOPE_ID,
  MIXED_SUBJECTS,
  buildMixedPaper,
  mixedCountOptions,
} from "./mixed";

/** 種子化 LCG:測試中取代 Math.random,輸出可重現。 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const ID_PREFIXES = {
  chinese: "chi-",
  math: "math-",
  english: "eng-",
} as const;

function idsBySubject(ids: string[]): Record<string, string[]> {
  return Object.fromEntries(
    MIXED_SUBJECTS.map((subject) => [
      subject,
      ids.filter((id) => id.startsWith(ID_PREFIXES[subject])),
    ]),
  );
}

describe("mixedCountOptions", () => {
  it("runs from the minimum to the whole pool in steps of 10", () => {
    const options = mixedCountOptions();
    expect(options[0]).toBe(MIXED_MIN_QUESTIONS);
    expect(options.at(-1)).toBe(MIXED_POOL_TOTAL);
    expect(MIXED_POOL_TOTAL).toBe(300);
    for (let index = 1; index < options.length; index += 1) {
      expect(options[index] - options[index - 1]).toBe(10);
    }
  });
});

describe("buildMixedPaper", () => {
  it("builds a single-section paper with the requested count", () => {
    const paper = buildMixedPaper(30, makeRng(1));
    expect(paper.subject).toBe("mixed");
    expect(paper.totalQuestions).toBe(30);
    expect(paper.sections).toHaveLength(1);
    expect(paper.sections[0].id).toBe(MIXED_SCOPE_ID);
    expect(paper.sections[0].questions).toHaveLength(30);
    expect(paper.questionPdf).toBeUndefined();
    expect(paper.answerPdf).toBeUndefined();
  });

  it("splits evenly across subjects (difference at most 1)", () => {
    for (const [count, seed] of [
      [10, 2],
      [50, 3],
      [130, 4],
    ] as const) {
      const paper = buildMixedPaper(count, makeRng(seed));
      const ids = paper.sections[0].questions.map((question) => question.id);
      const groups = idsBySubject(ids);
      const sizes = MIXED_SUBJECTS.map((subject) => groups[subject].length);
      expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(count);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("never repeats a question and only draws from the real pools", () => {
    const paper = buildMixedPaper(90, makeRng(5));
    const ids = paper.sections[0].questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);

    const poolIds = new Set(
      MIXED_SUBJECTS.flatMap((subject) =>
        getAllQuestions(EXAM_PAPERS[subject]).map((question) => question.id),
      ),
    );
    for (const id of ids) {
      expect(poolIds.has(id), `${id} not in any pool`).toBe(true);
    }
  });

  it("orders questions 國語→數學→英文, each block in original paper order", () => {
    const paper = buildMixedPaper(45, makeRng(6));
    const ids = paper.sections[0].questions.map((question) => question.id);
    const groups = idsBySubject(ids);

    // 分區:直接串接各科群組應等於整卷順序
    expect(ids).toEqual(MIXED_SUBJECTS.flatMap((subject) => groups[subject]));

    // 各科內保持原卷順序
    for (const subject of MIXED_SUBJECTS) {
      const poolOrder = getAllQuestions(EXAM_PAPERS[subject]).map(
        (question) => question.id,
      );
      const picked = new Set(groups[subject]);
      expect(groups[subject]).toEqual(poolOrder.filter((id) => picked.has(id)));
    }
  });

  it("returns every question exactly once at the full pool size", () => {
    const paper = buildMixedPaper(MIXED_POOL_TOTAL, makeRng(7));
    const ids = paper.sections[0].questions.map((question) => question.id);
    expect(ids).toHaveLength(MIXED_POOL_TOTAL);
    expect(new Set(ids).size).toBe(MIXED_POOL_TOTAL);
  });

  it("clamps the count into [min, pool total]", () => {
    expect(buildMixedPaper(3, makeRng(8)).totalQuestions).toBe(
      MIXED_MIN_QUESTIONS,
    );
    expect(buildMixedPaper(9999, makeRng(9)).totalQuestions).toBe(
      MIXED_POOL_TOTAL,
    );
  });

  it("is deterministic for the same seed and varies across seeds", () => {
    const ids = (seed: number) =>
      buildMixedPaper(30, makeRng(seed)).sections[0].questions.map(
        (question) => question.id,
      );
    expect(ids(42)).toEqual(ids(42));
    expect(ids(42)).not.toEqual(ids(43));
  });

  it("summarizes the composition in the section subtitle", () => {
    const paper = buildMixedPaper(10, makeRng(10));
    const ids = paper.sections[0].questions.map((question) => question.id);
    const groups = idsBySubject(ids);
    expect(paper.sections[0].subtitle).toBe(
      `國語 ${groups.chinese.length} 題・數學 ${groups.math.length} 題・英文 ${groups.english.length} 題`,
    );
    expect(paper.title).toBe("隨機綜合卷（10 題）");
  });
});
