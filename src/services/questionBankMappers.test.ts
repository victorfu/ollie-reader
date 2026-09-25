import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  Timestamp: {
    now: vi.fn(() => ({ kind: "now" })),
    fromDate: vi.fn((date: Date) => ({ kind: "fromDate", date })),
  },
}));

import { makePage, makeQuestion } from "../testing/questionBankFixtures";
import {
  toBankQuestion,
  toBox,
  toExamSheet,
  toFirestorePages,
  toFirestoreQuestion,
  toQuestionSource,
} from "./questionBankMappers";

const stamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe("toBox", () => {
  it("accepts four finite numbers and rejects everything else", () => {
    expect(toBox({ x: 0, y: 0.1, w: 0.2, h: 0.3 })).toEqual({ x: 0, y: 0.1, w: 0.2, h: 0.3 });
    expect(toBox({ x: 0, y: 0.1, w: 0.2 })).toBeNull();
    expect(toBox({ x: Number.NaN, y: 0, w: 1, h: 1 })).toBeNull();
    expect(toBox(null)).toBeNull();
  });
});

describe("toQuestionSource", () => {
  const valid = {
    userId: "user-1",
    title: "月考",
    subject: "math",
    pages: [{ storagePath: "p0.jpg", width: 100, height: 200 }],
    createdAt: stamp("2026-09-01T00:00:00Z"),
    updatedAt: stamp("2026-09-02T00:00:00Z"),
  };

  it("maps a valid document and defaults missing masks to []", () => {
    expect(toQuestionSource("s1", valid)).toEqual({
      id: "s1",
      userId: "user-1",
      title: "月考",
      subject: "math",
      pages: [{ storagePath: "p0.jpg", width: 100, height: 200, masks: [] }],
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-02T00:00:00Z"),
    });
  });

  it("rejects a source with a broken page (page indexes would shift)", () => {
    expect(toQuestionSource("s1", { ...valid, pages: [{ storagePath: "p0.jpg" }] })).toBeNull();
  });

  it("rejects an unknown subject", () => {
    expect(toQuestionSource("s1", { ...valid, subject: "music" })).toBeNull();
  });
});

describe("toBankQuestion", () => {
  const valid = {
    userId: "user-1",
    sourceId: "s1",
    subject: "chinese",
    regions: [
      { pageIndex: 0, box: { x: 0, y: 0, w: 0.5, h: 0.5 } },
      { pageIndex: 1, box: { x: 0, y: 0 } },
    ],
    answerSpace: "medium",
    createdAt: stamp("2026-09-01T00:00:00Z"),
    updatedAt: stamp("2026-09-01T00:00:00Z"),
  };

  it("drops broken regions and has no answer key when there is no answer", () => {
    const question = toBankQuestion("q1", valid);
    expect(question?.regions).toEqual([{ pageIndex: 0, box: { x: 0, y: 0, w: 0.5, h: 0.5 } }]);
    expect(question && "answer" in question).toBe(false);
    expect(question?.answerSpace).toBe("medium");
  });

  it("returns null when no region survives", () => {
    expect(toBankQuestion("q1", { ...valid, regions: [] })).toBeNull();
  });

  it("falls back to no extra answer space for unknown values", () => {
    expect(toBankQuestion("q1", { ...valid, answerSpace: "huge" })?.answerSpace).toBe("none");
  });

  it("keeps a non-empty answer", () => {
    expect(toBankQuestion("q1", { ...valid, answer: "(3)" })?.answer).toBe("(3)");
  });
});

describe("toFirestoreQuestion", () => {
  it("never writes undefined and omits an empty answer", () => {
    const data = toFirestoreQuestion(makeQuestion({ answer: undefined }));
    expect(Object.values(data)).not.toContain(undefined);
    expect("answer" in data).toBe(false);
    expect("answer" in toFirestoreQuestion(makeQuestion({ answer: "   " }))).toBe(false);
  });

  it("trims the answer and converts dates", () => {
    const createdAt = new Date("2026-09-01T00:00:00Z");
    const data = toFirestoreQuestion(makeQuestion({ answer: " 12 公分 ", createdAt }));
    expect(data.answer).toBe("12 公分");
    expect(data.createdAt).toEqual({ kind: "fromDate", date: createdAt });
    expect(data.updatedAt).toEqual({ kind: "now" });
    expect(data).not.toHaveProperty("id");
  });
});

describe("toFirestorePages", () => {
  it("writes plain page objects", () => {
    const pages = [makePage({ masks: [{ x: 0, y: 0, w: 0.1, h: 0.1 }] })];
    expect(toFirestorePages(pages)).toEqual([
      {
        storagePath: pages[0].storagePath,
        width: 1000,
        height: 1400,
        masks: [{ x: 0, y: 0, w: 0.1, h: 0.1 }],
      },
    ]);
  });
});

describe("toExamSheet", () => {
  it("maps a sheet and keeps only string question ids in order", () => {
    expect(
      toExamSheet("sheet-1", {
        userId: "user-1",
        title: "期中考複習",
        questionIds: ["q2", 3, "q1"],
        createdAt: stamp("2026-09-01T00:00:00Z"),
        updatedAt: stamp("2026-09-02T00:00:00Z"),
      }),
    ).toEqual({
      id: "sheet-1",
      userId: "user-1",
      title: "期中考複習",
      questionIds: ["q2", "q1"],
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-02T00:00:00Z"),
    });
  });

  it("rejects a sheet without an owner", () => {
    expect(toExamSheet("sheet-1", { title: "x", questionIds: [] })).toBeNull();
  });
});
