import { describe, expect, it } from "vitest";
import {
  ANSWER_SPACES,
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  isAnswerSpace,
  isBankSubject,
} from "./questionBank";

describe("isBankSubject", () => {
  it("accepts the five subjects", () => {
    for (const subject of BANK_SUBJECTS) {
      expect(isBankSubject(subject)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isBankSubject("mixed")).toBe(false);
    expect(isBankSubject("")).toBe(false);
    expect(isBankSubject(undefined)).toBe(false);
    expect(isBankSubject(3)).toBe(false);
  });

  it("labels every subject in Traditional Chinese", () => {
    expect(BANK_SUBJECTS.map((subject) => BANK_SUBJECT_LABELS[subject])).toEqual([
      "國語",
      "數學",
      "英文",
      "自然",
      "社會",
    ]);
  });
});

describe("isAnswerSpace", () => {
  it("accepts the four sizes and rejects others", () => {
    for (const space of ANSWER_SPACES) {
      expect(isAnswerSpace(space)).toBe(true);
    }
    expect(isAnswerSpace("huge")).toBe(false);
    expect(isAnswerSpace(null)).toBe(false);
  });
});
