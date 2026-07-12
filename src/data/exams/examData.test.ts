import { describe, expect, it } from "vitest";
import type {
  ExamChoiceQuestion,
  ExamPaper,
  ExamSubject,
} from "../../types/exam";
import { isTextQuestion } from "../../types/exam";
import { EXAM_PAPERS, getAllQuestions } from "./index";
import { CHINESE_ANSWER_KEY } from "./chineseAnswerKey";
import { MATH_ANSWER_KEY } from "./mathAnswerKey";
import {
  answerWords,
  normalizeAnswer,
} from "../../components/ExamPractice/examAnswerMatching";

// 用 import.meta.glob 做檔案存在性檢查(僅取 key,不載入內容),
// 免依賴 node:fs——app tsconfig 沒有 Node types。
const IMAGE_FILES = new Set(
  Object.keys(import.meta.glob("../../../public/exams/images/*.png")).map(
    (key) => key.split("/").pop() ?? key,
  ),
);
const PAPER_FILE_PATHS = Object.keys(
  import.meta.glob([
    "../../../public/exams/*.pdf",
    "../../../public/exams/*.jpg",
  ]),
);

const EXPECTED_SECTION_COUNTS: Record<ExamSubject, number[]> = {
  chinese: [8, 26, 25, 30, 11],
  math: [25, 25, 25, 25],
  english: [30, 25, 20, 25],
};

const ID_PREFIXES: Record<ExamSubject, string> = {
  chinese: "chi",
  math: "math",
  english: "eng",
};

/**
 * 獨立轉錄的標準答案(雙重輸入防錯)。英文卷為原創編寫、
 * 無獨立答案來源,不做交叉比對——改由下方打字題結構不變式把關。
 */
const ANSWER_KEYS: Partial<
  Record<ExamSubject, readonly (1 | 2 | 3 | 4)[]>
> = {
  chinese: CHINESE_ANSWER_KEY,
  math: MATH_ANSWER_KEY,
};

/** 全部為打字題的區段;其餘區段必須全部為選擇題。 */
const TEXT_SECTION_IDS: Partial<Record<ExamSubject, readonly string[]>> = {
  english: ["eng-s4"],
};

const TEXT_FORMS = new Set(["qa", "unscramble", "dictation"]);

const FRACTION_PATTERN = /^\{\d+\/\d+\}$/;

function braceTokens(text: string): string[] {
  return text.match(/\{[^}]*\}/g) ?? [];
}

function choiceOptionCount(question: ExamChoiceQuestion): number {
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
      const prefix = ID_PREFIXES[paper.subject];
      const ids = questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      questions.forEach((question, index) => {
        expect(question.id).toBe(`${prefix}-${String(index + 1).padStart(3, "0")}`);
      });
    });

    it("has printed numbers contiguous from 1 within each numbering block", () => {
      // 國語卷每個大題題號重新起算;數學卷、英文卷全卷連續編號。
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

    it.runIf(answerKey !== undefined)(
      "cross-checks every answerIndex against the independently transcribed key",
      () => {
        expect(answerKey?.length).toBe(100);
        questions.forEach((question, index) => {
          if (isTextQuestion(question)) return;
          expect(
            question.answerIndex,
            `${question.id} answerIndex vs answer key`,
          ).toBe((answerKey?.[index] ?? 0) - 1);
        });
      },
    );

    it("keeps text questions only in the designated text sections", () => {
      const textSections = new Set(TEXT_SECTION_IDS[paper.subject] ?? []);
      for (const section of paper.sections) {
        for (const question of section.questions) {
          expect(
            isTextQuestion(question),
            `${question.id} kind vs section ${section.id}`,
          ).toBe(textSections.has(section.id));
        }
      }
    });

    it("has valid options / image options / typed-answer fields for every question", () => {
      for (const question of questions) {
        expect(question.text.trim().length, `${question.id} empty text`).toBeGreaterThan(0);
        if (question.explanation !== undefined) {
          expect(question.explanation.trim().length).toBeGreaterThan(0);
        }
        if (question.audioText !== undefined) {
          expect(question.audioText.trim().length, `${question.id} audioText`).toBeGreaterThan(0);
        }

        if (isTextQuestion(question)) {
          // 打字題:批改資料的結構不變式
          expect(TEXT_FORMS.has(question.form), `${question.id} form`).toBe(true);
          expect(question.image, `${question.id} text question with image`).toBeUndefined();
          expect(question.imageAlt).toBeUndefined();
          expect(
            question.acceptedAnswers.length,
            `${question.id} acceptedAnswers`,
          ).toBeGreaterThanOrEqual(1);
          const normalized = question.acceptedAnswers.map((answer) => {
            expect(answer, `${question.id} parentheses in "${answer}"`).not.toMatch(/[()（）]/);
            const cleaned = normalizeAnswer(answer);
            expect(cleaned.length, `${question.id} unnormalizable "${answer}"`).toBeGreaterThan(0);
            return cleaned;
          });
          expect(
            new Set(normalized).size,
            `${question.id} duplicate accepted answers after normalization`,
          ).toBe(normalized.length);

          if (question.form === "dictation") {
            // 語音與標準答案不得漂移
            expect(question.audioText, `${question.id} dictation audio`).toBeTruthy();
            expect(normalizeAnswer(question.audioText ?? "")).toBe(
              normalizeAnswer(question.acceptedAnswers[0]),
            );
          }
          if (question.form === "unscramble") {
            const hint = question.hint ?? "";
            expect(hint.length, `${question.id} unscramble hint`).toBeGreaterThan(0);
            expect(question.audioText, `${question.id} unscramble audio leaks order`).toBeUndefined();
            const hintWords = answerWords(hint.replaceAll("/", " "));
            const canonicalWords = answerWords(question.acceptedAnswers[0]);
            // 字卡多重集必須等於標準答案的單字多重集
            expect([...hintWords].sort()).toEqual([...canonicalWords].sort());
            // 且順序必須真的有打散
            expect(hintWords.join(" ")).not.toBe(canonicalWords.join(" "));
          }
          continue;
        }

        // 選擇題:原有不變式
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
        expect(question.answerIndex).toBeLessThan(choiceOptionCount(question));
      }
    });

    it("uses only well-formed fraction markup in all text fields", () => {
      for (const question of questions) {
        const fields = isTextQuestion(question)
          ? [
              question.text,
              question.explanation ?? "",
              question.hint ?? "",
              ...question.acceptedAnswers,
            ]
          : [
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

    it("points paper links at real files under public/", () => {
      if (paper.questionPdf) {
        expect(
          PAPER_FILE_PATHS.some((path) => path.endsWith(paper.questionPdf ?? "")),
        ).toBe(true);
      }
      if (paper.answerPdf) {
        expect(
          PAPER_FILE_PATHS.some((path) => path.endsWith(paper.answerPdf ?? "")),
        ).toBe(true);
      }
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
