import { describe, expect, it } from "vitest";
import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import {
  changeOf,
  cropEditorReducer,
  type CropEditorState,
} from "./cropEditorState";

const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
const other = { x: 0.5, y: 0.5, w: 0.3, h: 0.1 };

function initial(): CropEditorState {
  return {
    source: makeSource({ pages: [makePage(), makePage({ storagePath: "p1.jpg" })] }),
    questions: [makeQuestion({ id: "q1", regions: [{ pageIndex: 0, box }] })],
  };
}

describe("cropEditorReducer", () => {
  it("creates a question", () => {
    const question = makeQuestion({ id: "q2" });
    const next = cropEditorReducer(initial(), { type: "createQuestion", question });
    expect(next.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("appends, updates and removes regions but always keeps one", () => {
    let state = cropEditorReducer(initial(), {
      type: "appendRegion",
      questionId: "q1",
      region: { pageIndex: 1, box: other },
    });
    expect(state.questions[0].regions).toEqual([
      { pageIndex: 0, box },
      { pageIndex: 1, box: other },
    ]);

    state = cropEditorReducer(state, { type: "updateRegion", questionId: "q1", regionIndex: 1, box });
    expect(state.questions[0].regions[1]).toEqual({ pageIndex: 1, box });

    state = cropEditorReducer(state, { type: "removeRegion", questionId: "q1", regionIndex: 0 });
    expect(state.questions[0].regions).toEqual([{ pageIndex: 1, box }]);

    const unchanged = cropEditorReducer(state, { type: "removeRegion", questionId: "q1", regionIndex: 0 });
    expect(unchanged.questions[0].regions).toHaveLength(1);
  });

  it("patches question fields and clears an emptied answer", () => {
    let state = cropEditorReducer(initial(), {
      type: "updateQuestion",
      questionId: "q1",
      patch: { subject: "science", answer: "(2)", answerSpace: "large" },
    });
    expect(state.questions[0]).toMatchObject({ subject: "science", answer: "(2)", answerSpace: "large" });

    state = cropEditorReducer(state, { type: "updateQuestion", questionId: "q1", patch: { answer: "" } });
    expect("answer" in state.questions[0]).toBe(false);
  });

  it("deletes a question", () => {
    expect(cropEditorReducer(initial(), { type: "deleteQuestion", questionId: "q1" }).questions).toEqual([]);
  });

  it("adds, updates and removes masks on one page only", () => {
    let state = cropEditorReducer(initial(), { type: "addMask", pageIndex: 1, box });
    state = cropEditorReducer(state, { type: "addMask", pageIndex: 1, box: other });
    expect(state.source.pages[0].masks).toEqual([]);
    expect(state.source.pages[1].masks).toEqual([box, other]);

    state = cropEditorReducer(state, { type: "updateMask", pageIndex: 1, maskIndex: 0, box: other });
    expect(state.source.pages[1].masks).toEqual([other, other]);

    state = cropEditorReducer(state, { type: "removeMask", pageIndex: 1, maskIndex: 1 });
    expect(state.source.pages[1].masks).toEqual([other]);
  });

  it("renames the source", () => {
    expect(cropEditorReducer(initial(), { type: "renameSource", title: "期中考" }).source.title).toBe("期中考");
  });
});

describe("changeOf", () => {
  it("maps each action to what autosave must write", () => {
    expect(changeOf({ type: "createQuestion", question: makeQuestion({ id: "q9" }) })).toEqual({ kind: "upsert", id: "q9" });
    expect(changeOf({ type: "updateRegion", questionId: "q1", regionIndex: 0, box })).toEqual({ kind: "upsert", id: "q1" });
    expect(changeOf({ type: "updateQuestion", questionId: "q1", patch: {} })).toEqual({ kind: "upsert", id: "q1" });
    expect(changeOf({ type: "deleteQuestion", questionId: "q1" })).toEqual({ kind: "delete", id: "q1" });
    expect(changeOf({ type: "addMask", pageIndex: 0, box })).toEqual({ kind: "source" });
    expect(changeOf({ type: "renameSource", title: "x" })).toEqual({ kind: "source" });
  });
});
