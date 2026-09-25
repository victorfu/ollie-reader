import { describe, expect, it } from "vitest";
import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import {
  orderBankQuestions,
  questionsOnPage,
  regionsOnPage,
  sortQuestionsInSource,
} from "./questionOrdering";

const at = (iso: string) => new Date(iso);
const box = { x: 0.1, y: 0.1, w: 0.3, h: 0.1 };

describe("sortQuestionsInSource", () => {
  it("orders by creation time, not by position (two-column papers)", () => {
    const rightColumn = makeQuestion({
      id: "right",
      createdAt: at("2026-09-01T00:00:02Z"),
      regions: [{ pageIndex: 0, box: { x: 0.5, y: 0.1, w: 0.4, h: 0.1 } }],
    });
    const leftColumn = makeQuestion({
      id: "left",
      createdAt: at("2026-09-01T00:00:01Z"),
      regions: [{ pageIndex: 0, box: { x: 0.05, y: 0.8, w: 0.4, h: 0.1 } }],
    });
    expect(
      sortQuestionsInSource([rightColumn, leftColumn]).map((q) => q.id),
    ).toEqual(["left", "right"]);
  });

  it("breaks ties by id", () => {
    const same = at("2026-09-01T00:00:00Z");
    const b = makeQuestion({ id: "b", createdAt: same });
    const a = makeQuestion({ id: "a", createdAt: same });
    expect(sortQuestionsInSource([b, a]).map((q) => q.id)).toEqual(["a", "b"]);
  });
});

describe("orderBankQuestions", () => {
  it("groups by source (newest first), then by creation order", () => {
    const oldSource = makeSource({ id: "old", createdAt: at("2026-08-01T00:00:00Z") });
    const newSource = makeSource({ id: "new", createdAt: at("2026-09-01T00:00:00Z") });
    const questions = [
      makeQuestion({ id: "old-1", sourceId: "old", createdAt: at("2026-08-01T00:00:01Z") }),
      makeQuestion({ id: "new-2", sourceId: "new", createdAt: at("2026-09-01T00:00:02Z") }),
      makeQuestion({ id: "orphan", sourceId: "gone", createdAt: at("2026-07-01T00:00:00Z") }),
      makeQuestion({ id: "new-1", sourceId: "new", createdAt: at("2026-09-01T00:00:01Z") }),
    ];
    expect(
      orderBankQuestions(questions, [oldSource, newSource]).map((q) => q.id),
    ).toEqual(["new-1", "new-2", "old-1", "orphan"]);
  });
});

describe("regionsOnPage", () => {
  const first = makeQuestion({
    id: "q1",
    createdAt: at("2026-09-01T00:00:01Z"),
    regions: [
      { pageIndex: 0, box },
      { pageIndex: 1, box },
    ],
  });
  const second = makeQuestion({
    id: "q2",
    createdAt: at("2026-09-01T00:00:02Z"),
    regions: [{ pageIndex: 1, box }],
  });
  const sorted = [first, second];

  it("uses source-wide numbers and flags continuation regions", () => {
    expect(
      regionsOnPage(sorted, 1).map((entry) => ({
        id: entry.question.id,
        number: entry.number,
        regionIndex: entry.regionIndex,
        isContinuation: entry.isContinuation,
      })),
    ).toEqual([
      { id: "q1", number: 1, regionIndex: 1, isContinuation: true },
      { id: "q2", number: 2, regionIndex: 0, isContinuation: false },
    ]);
  });
});

describe("questionsOnPage", () => {
  it("lists each question once and marks when it started on another page", () => {
    const crossColumn = makeQuestion({
      id: "q1",
      createdAt: at("2026-09-01T00:00:01Z"),
      regions: [
        { pageIndex: 0, box },
        { pageIndex: 0, box: { ...box, x: 0.5 } },
      ],
    });
    const crossPage = makeQuestion({
      id: "q2",
      createdAt: at("2026-09-01T00:00:02Z"),
      regions: [
        { pageIndex: 0, box },
        { pageIndex: 1, box },
      ],
    });
    const sorted = [crossColumn, crossPage];

    expect(questionsOnPage(sorted, 0).map((e) => [e.question.id, e.number, e.isContinuation])).toEqual([
      ["q1", 1, false],
      ["q2", 2, false],
    ]);
    expect(questionsOnPage(sorted, 1).map((e) => [e.question.id, e.number, e.isContinuation])).toEqual([
      ["q2", 2, true],
    ]);
  });
});
