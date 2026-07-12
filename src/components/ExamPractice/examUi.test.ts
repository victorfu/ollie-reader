import { describe, expect, it } from "vitest";
import { EXAM_PAPERS, getAllQuestions } from "../../data/exams";
import { buildMixedPaper } from "../../data/exams/mixed";
import { questionLabel } from "./examUi";

function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("questionLabel", () => {
  it("keeps the fixed-subject formats", () => {
    const chinese = EXAM_PAPERS.chinese;
    const chiFirst = chinese.sections[0].questions[0];
    expect(questionLabel(chinese, chiFirst)).toBe(
      `${chinese.sections[0].title}・第 ${chiFirst.number} 題`,
    );

    const math = EXAM_PAPERS.math;
    const mathQuestion = getAllQuestions(math)[24];
    expect(questionLabel(math, mathQuestion)).toBe(
      `第 ${mathQuestion.number} 題`,
    );
  });

  it("prefixes the origin subject on a mixed paper", () => {
    const mixed = buildMixedPaper(300, seededRng(1)); // 全取,三科都在卷內
    const questions = mixed.sections[0].questions;

    const chiQuestion = questions.find((q) => q.id.startsWith("chi-"));
    const mathQuestion = questions.find((q) => q.id.startsWith("math-"));
    const engQuestion = questions.find((q) => q.id.startsWith("eng-"));
    if (!chiQuestion || !mathQuestion || !engQuestion) throw new Error("fixture");

    const chiSection = EXAM_PAPERS.chinese.sections.find(
      (section) => section.id === chiQuestion.sectionId,
    );
    expect(questionLabel(mixed, chiQuestion)).toBe(
      `國語・${chiSection?.title}・第 ${chiQuestion.number} 題`,
    );
    expect(questionLabel(mixed, mathQuestion)).toBe(
      `數學・第 ${mathQuestion.number} 題`,
    );
    expect(questionLabel(mixed, engQuestion)).toBe(
      `英文・第 ${engQuestion.number} 題`,
    );
  });
});
