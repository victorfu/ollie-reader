import { describe, expect, it } from "vitest";
import type { ExamPaper, ExamQuestion } from "../../types/exam";
import { EXAM_PAPERS, getAllQuestions } from "./index";
import { CHINESE_ANSWER_KEY } from "./chineseAnswerKey";
import { MATH_ANSWER_KEY } from "./mathAnswerKey";

// 用 import.meta.glob 做檔案存在性檢查(僅取 key,不載入內容),
// 免依賴 node:fs——app tsconfig 沒有 Node types。
const IMAGE_FILES = new Set(
  Object.keys(import.meta.glob("../../../public/exams/images/*.png")).map(
    (key) => key.split("/").pop() ?? key,
  ),
);
const PDF_PATHS = Object.keys(import.meta.glob("../../../public/exams/*.pdf"));

const EXPECTED_SECTION_COUNTS: Record<string, number[]> = {
  chinese: [8, 26, 25, 30, 11],
  math: [25, 25, 25, 25],
};

const ANSWER_KEYS: Record<string, readonly (1 | 2 | 3 | 4)[]> = {
  chinese: CHINESE_ANSWER_KEY,
  math: MATH_ANSWER_KEY,
};

const FRACTION_PATTERN = /^\{\d+\/\d+\}$/;

function braceTokens(text: string): string[] {
  return text.match(/\{[^}]*\}/g) ?? [];
}

function optionCountOf(question: ExamQuestion): number {
  if (question.imageContainsOptions) return question.optionCount ?? 4;
  return question.options?.length ?? 0;
}

describe.each(Object.values(EXAM_PAPERS))(
  "exam data integrity: $subject",
  (paper: ExamPaper) => {
    const questions = getAllQuestions(paper);
    const answerKey = ANSWER_KEYS[paper.subject];

    it("has the exact per-section question counts", () => {
      expect(paper.sections.map((s) => s.questions.length)).toEqual(
        EXPECTED_SECTION_COUNTS[paper.subject],
      );
      expect(questions.length).toBe(paper.totalQuestions);
      expect(paper.totalQuestions).toBe(100);
    });

    it("has unique, contiguous, well-formed ids matching paper order", () => {
      const prefix = paper.subject === "chinese" ? "chi" : "math";
      const ids = questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      questions.forEach((question, index) => {
        expect(question.id).toBe(`${prefix}-${String(index + 1).padStart(3, "0")}`);
      });
    });

    it("has printed numbers contiguous from 1 within each numbering block", () => {
      // 國語卷每個大題題號重新起算;數學卷單一編號跨四個部分連續。
      if (paper.subject === "chinese") {
        for (const section of paper.sections) {
          section.questions.forEach((question, index) => {
            expect(question.number).toBe(index + 1);
            expect(question.sectionId).toBe(section.id);
          });
        }
      } else {
        questions.forEach((question, index) => {
          expect(question.number).toBe(index + 1);
        });
        for (const section of paper.sections) {
          for (const question of section.questions) {
            expect(question.sectionId).toBe(section.id);
          }
        }
      }
    });

    it("cross-checks every answerIndex against the independently transcribed key", () => {
      expect(answerKey.length).toBe(100);
      questions.forEach((question, index) => {
        expect(
          question.answerIndex,
          `${question.id} answerIndex vs answer key`,
        ).toBe(answerKey[index] - 1);
      });
    });

    it("has valid options or image-contained options for every question", () => {
      for (const question of questions) {
        if (question.imageContainsOptions) {
          expect(question.image, `${question.id} needs image`).toBeTruthy();
          expect(question.imageAlt?.trim(), `${question.id} imageAlt`).toBeTruthy();
          expect(question.options, `${question.id} options in image`).toBeUndefined();
          const count = question.optionCount ?? 4;
          expect(count).toBeGreaterThanOrEqual(2);
          expect(count).toBeLessThanOrEqual(4);
          expect(
            question.imageOptionLabels?.length,
            `${question.id} image option labels`,
          ).toBe(count);
          for (const label of question.imageOptionLabels ?? []) {
            expect(
              label.trim().length,
              `${question.id} empty image option label`,
            ).toBeGreaterThan(0);
          }
          expect(new Set(question.imageOptionLabels).size).toBe(count);
        } else {
          expect(question.optionCount, `${question.id} optionCount`).toBeUndefined();
          expect(
            question.imageOptionLabels,
            `${question.id} imageOptionLabels without image options`,
          ).toBeUndefined();
          expect(question.options, `${question.id} options`).toBeDefined();
          expect(question.options?.length, `${question.id} option count`).toBe(4);
          for (const option of question.options ?? []) {
            expect(option.trim().length, `${question.id} empty option`).toBeGreaterThan(0);
          }
          expect(
            new Set(question.options).size,
            `${question.id} duplicate options`,
          ).toBe(question.options?.length);
        }
        if (question.image) {
          expect(question.imageAlt?.trim(), `${question.id} imageAlt`).toBeTruthy();
        } else {
          expect(question.imageAlt, `${question.id} imageAlt without image`).toBeUndefined();
        }
        expect(question.answerIndex).toBeGreaterThanOrEqual(0);
        expect(question.answerIndex).toBeLessThan(optionCountOf(question));
        expect(question.text.trim().length, `${question.id} empty text`).toBeGreaterThan(0);
        if (question.explanation !== undefined) {
          expect(question.explanation.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it("uses only well-formed fraction markup in all text fields", () => {
      for (const question of questions) {
        const fields = [
          question.text,
          question.explanation ?? "",
          ...(question.options ?? []),
        ];
        for (const field of fields) {
          for (const token of braceTokens(field)) {
            expect(token, `${question.id} malformed fraction "${token}"`).toMatch(
              FRACTION_PATTERN,
            );
          }
          const withoutValidFractions = field.replace(/\d*\{\d+\/\d+\}/g, "");
          expect(
            withoutValidFractions,
            `${question.id} has an unmatched fraction brace`,
          ).not.toMatch(/[{}]/);
        }
      }
    });

    it("points questionPdf/answerPdf at real files under public/", () => {
      expect(PDF_PATHS.some((path) => path.endsWith(paper.questionPdf))).toBe(true);
      expect(PDF_PATHS.some((path) => path.endsWith(paper.answerPdf))).toBe(true);
    });
  },
);

describe("exam ids are unique across papers", () => {
  it("has no id collisions between subjects", () => {
    const all = Object.values(EXAM_PAPERS).flatMap((paper) =>
      getAllQuestions(paper).map((q) => q.id),
    );
    expect(new Set(all).size).toBe(all.length);
  });
});

// 裁圖尚未產出前(目錄為空/不存在)先跳過;public/exams/images/ 進版控後永遠啟用。
describe.skipIf(IMAGE_FILES.size === 0)("exam images", () => {
  const referenced = new Map<string, string>();
  for (const paper of Object.values(EXAM_PAPERS)) {
    for (const question of getAllQuestions(paper)) {
      if (question.image) referenced.set(question.image, question.id);
    }
  }

  it("has a file for every referenced image", () => {
    for (const [file, questionId] of referenced) {
      expect(
        IMAGE_FILES.has(file),
        `${questionId} references missing image ${file}`,
      ).toBe(true);
    }
  });

  it("has no orphan PNGs in public/exams/images", () => {
    for (const file of IMAGE_FILES) {
      expect(referenced.has(file), `orphan image ${file}`).toBe(true);
    }
  });
});
