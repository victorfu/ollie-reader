import { describe, expect, it } from "vitest";
import { makeQuestion } from "../../testing/questionBankFixtures";
import { seededRng } from "../../testing/seededRng";
import {
  appendUnique,
  buildSheetQuestions,
  canReplaceAt,
  countBySubject,
  defaultSheetTitle,
  moveAt,
  removeAt,
  replaceAt,
  resolveSheetQuestions,
} from "./sheetComposition";

const math = ["m1", "m2", "m3"].map((id) => makeQuestion({ id, subject: "math" }));
const chinese = ["c1", "c2"].map((id) => makeQuestion({ id, subject: "chinese" }));
const bank = [...math, ...chinese];
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("countBySubject", () => {
  it("counts every subject, including empty ones", () => {
    expect(countBySubject(bank)).toEqual({ chinese: 2, math: 3, english: 0, science: 0, social: 0 });
  });
});

describe("buildSheetQuestions", () => {
  it("draws each subject separately and orders subjects chinese → math → …", () => {
    const sheet = buildSheetQuestions(bank, { math: 2, chinese: 1 }, seededRng(1));
    expect(sheet.map((question) => question.subject)).toEqual(["chinese", "math", "math"]);
    expect(new Set(ids(sheet)).size).toBe(3);
  });

  it("skips subjects with no or zero count", () => {
    expect(buildSheetQuestions(bank, { math: 0 }, seededRng(1))).toEqual([]);
    expect(buildSheetQuestions(bank, {}, seededRng(1))).toEqual([]);
  });
});

describe("canReplaceAt / replaceAt", () => {
  it("replaces with an unused question of the same subject", () => {
    const list = [math[0], math[1], chinese[0]];
    expect(canReplaceAt(list, 0, bank)).toBe(true);
    const next = replaceAt(list, 0, bank, seededRng(5));
    expect(ids(next)).toEqual(["m3", "m2", "c1"]);
  });

  it("reports when every question of that subject is already used", () => {
    const list = [...math];
    expect(canReplaceAt(list, 1, bank)).toBe(false);
    expect(ids(replaceAt(list, 1, bank, seededRng(5)))).toEqual(["m1", "m2", "m3"]);
  });

  it("is false for an index outside the list", () => {
    expect(canReplaceAt([math[0]], 3, bank)).toBe(false);
  });
});

describe("moveAt / removeAt / appendUnique", () => {
  it("swaps with the neighbour and ignores moves past the ends", () => {
    expect(moveAt(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveAt(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveAt(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveAt(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });

  it("removes one item", () => {
    expect(removeAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("appends only questions that are not in the list yet", () => {
    expect(ids(appendUnique([math[0]], [math[0], chinese[1]]))).toEqual(["m1", "c2"]);
  });
});

describe("resolveSheetQuestions", () => {
  it("keeps the saved order and counts deleted questions", () => {
    expect(resolveSheetQuestions(["c2", "gone", "m1"], bank)).toEqual({
      questions: [chinese[1], math[0]],
      missingCount: 1,
    });
  });
});

describe("defaultSheetTitle", () => {
  it("uses today's date with zero padding", () => {
    expect(defaultSheetTitle(new Date(2026, 8, 4))).toBe("自製考卷 2026/09/04");
  });
});
