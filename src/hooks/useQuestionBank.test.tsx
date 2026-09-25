import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "user-1" } },
  listSources: vi.fn(),
  listBankQuestions: vi.fn(),
  listSheets: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("../services/questionSourceService", () => ({ listSources: mocks.listSources }));
vi.mock("../services/bankQuestionService", () => ({ listBankQuestions: mocks.listBankQuestions }));
vi.mock("../services/examSheetService", () => ({ listSheets: mocks.listSheets }));
vi.mock("../utils/logger", () => ({ logger: { error: mocks.loggerError } }));

import { makeQuestion, makeSource } from "../testing/questionBankFixtures";
import type { ExamSheet } from "../types/questionBank";
import { useQuestionBank } from "./useQuestionBank";

type QuestionBankHook = ReturnType<typeof useQuestionBank>;

const sheet: ExamSheet = {
  id: "sheet-1",
  userId: "user-1",
  title: "期中考複習",
  questionIds: ["question-1"],
  createdAt: new Date("2026-09-20T00:00:00Z"),
  updatedAt: new Date("2026-09-20T00:00:00Z"),
};

let container: HTMLDivElement;
let root: Root;

function renderHook() {
  let current: QuestionBankHook | null = null;

  function Harness() {
    const value = useQuestionBank();
    useEffect(() => {
      current = value;
    });
    return null;
  }

  act(() => root.render(<Harness />));
  return {
    get current() {
      if (!current) throw new Error("question bank hook did not render");
      return current;
    },
  };
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe("useQuestionBank", () => {
  it("loads sources, questions and sheets", async () => {
    const source = makeSource();
    const question = makeQuestion();
    mocks.listSources.mockResolvedValue([source]);
    mocks.listBankQuestions.mockResolvedValue([question]);
    mocks.listSheets.mockResolvedValue([sheet]);

    const hook = renderHook();
    await flushAsyncWork();

    expect(hook.current).toMatchObject({
      sources: [source],
      questions: [question],
      sheets: [sheet],
      loading: false,
      error: null,
    });
  });

  it("reports an error when any load fails", async () => {
    mocks.listSources.mockResolvedValue([makeSource()]);
    mocks.listBankQuestions.mockResolvedValue([makeQuestion()]);
    mocks.listSheets.mockRejectedValue(new Error("examSheets index missing"));

    const hook = renderHook();
    await flushAsyncWork();

    expect(hook.current.loading).toBe(false);
    expect(hook.current.error).toEqual(expect.any(String));
  });

  it("logs every failed load, not only the first", async () => {
    const sourcesError = new Error("questionSources index missing");
    const sheetsError = new Error("examSheets index missing");
    mocks.listSources.mockRejectedValue(sourcesError);
    mocks.listBankQuestions.mockResolvedValue([]);
    mocks.listSheets.mockRejectedValue(sheetsError);

    renderHook();
    await flushAsyncWork();

    expect(mocks.loggerError).toHaveBeenCalledWith(expect.any(String), sourcesError);
    expect(mocks.loggerError).toHaveBeenCalledWith(expect.any(String), sheetsError);
  });
});
