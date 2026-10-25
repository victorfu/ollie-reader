import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CefrLevel, WordPracticeState } from "../types/wordPractice";
import type { CefrTable } from "../utils/cefr";
import { DEFAULT_SETTINGS } from "../utils/reviewSchedule";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  loadCefrTable: vi.fn(),
  loadPracticeState: vi.fn(),
  generateGeminiContent: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../utils/cefr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/cefr")>()),
  loadCefrTable: mocks.loadCefrTable,
}));
vi.mock("../services/wordPracticeStorage", () => ({
  loadPracticeState: mocks.loadPracticeState,
}));
// The vocabulary book must never spend the shared Gemini quota on levels.
vi.mock("../services/geminiClient", () => ({ generateGeminiContent: mocks.generateGeminiContent }));
vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mocks.loggerError,
  },
}));

import { useCefrLevels, type UseCefrLevels } from "./useCefrLevels";

const TABLE: CefrTable = new Map<string, CefrLevel>([
  ["run", "A1"],
  ["river", "A2"],
]);

function practiceState(cefrEstimates: Record<string, CefrLevel>): WordPracticeState {
  return {
    schemaVersion: 2,
    activeHomeworkId: null,
    words: {},
    cefrEstimates,
    settings: DEFAULT_SETTINGS,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

let root: Root | null;
let host: HTMLDivElement | null;
let currentHook: UseCefrLevels | null;
let renderCount: number;

function Probe() {
  const levels = useCefrLevels();
  useEffect(() => {
    currentHook = levels;
    renderCount += 1;
  });
  return null;
}

function hook(): UseCefrLevels {
  if (!currentHook) throw new Error("CEFR hook did not render");
  return currentHook;
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function renderProbe() {
  root = createRoot(host as HTMLDivElement);
  await act(async () => {
    root?.render(<Probe />);
  });
  await flushAsyncWork();
}

async function rerenderProbe() {
  await act(async () => {
    root?.render(<Probe />);
  });
  await flushAsyncWork();
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  root = null;
  host = document.createElement("div");
  document.body.appendChild(host);
  currentHook = null;
  renderCount = 0;

  mocks.useAuth.mockReturnValue({ user: { uid: "user-1" } });
  mocks.loadCefrTable.mockResolvedValue(TABLE);
  mocks.loadPracticeState.mockResolvedValue(practiceState({ "bona fide": "C2" }));
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
});

describe("useCefrLevels", () => {
  it("is not ready and knows no levels until the table and the estimates are loaded", async () => {
    const table = deferred<CefrTable>();
    const state = deferred<WordPracticeState>();
    mocks.loadCefrTable.mockReturnValueOnce(table.promise);
    mocks.loadPracticeState.mockReturnValueOnce(state.promise);

    await renderProbe();

    expect(hook().ready).toBe(false);
    expect(hook().levelOf("run")).toBeNull();
    expect(hook().levelOf("bona fide")).toBeNull();

    await act(async () => {
      table.resolve(TABLE);
      state.resolve(practiceState({ "bona fide": "C2" }));
    });
    await flushAsyncWork();

    expect(hook().ready).toBe(true);
  });

  it("returns list levels for listed words and AI levels for estimate-only words", async () => {
    await renderProbe();

    expect(mocks.loadPracticeState).toHaveBeenCalledWith("user-1");
    expect(hook().levelOf("run")).toEqual({ level: "A1", source: "list" });
    expect(hook().levelOf("Run.")).toEqual({ level: "A1", source: "list" });
    expect(hook().levelOf("Bona  Fide")).toEqual({ level: "C2", source: "ai" });
    expect(hook().levelOf("xyzzy")).toBeNull();
  });

  it("prefers the list level over a stored estimate", async () => {
    mocks.loadPracticeState.mockResolvedValue(practiceState({ run: "C1" }));

    await renderProbe();

    expect(hook().levelOf("run")).toEqual({ level: "A1", source: "list" });
  });

  it("keeps list levels when the practice state cannot be loaded, and logs it", async () => {
    mocks.loadPracticeState.mockRejectedValue(new Error("offline"));

    await renderProbe();

    expect(hook().ready).toBe(true);
    expect(hook().levelOf("river")).toEqual({ level: "A2", source: "list" });
    expect(hook().levelOf("bona fide")).toBeNull();
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("keeps estimate levels when the table cannot be loaded, and is never ready", async () => {
    mocks.loadCefrTable.mockRejectedValue(new Error("chunk failed"));

    await renderProbe();

    expect(hook().ready).toBe(false);
    expect(hook().levelOf("run")).toBeNull();
    expect(hook().levelOf("bona fide")).toEqual({ level: "C2", source: "ai" });
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("shows list levels without reading practice state when signed out", async () => {
    mocks.useAuth.mockReturnValue({ user: null });

    await renderProbe();

    expect(mocks.loadPracticeState).not.toHaveBeenCalled();
    expect(hook().ready).toBe(true);
    expect(hook().levelOf("run")).toEqual({ level: "A1", source: "list" });
    expect(hook().levelOf("bona fide")).toBeNull();
  });

  it("loads once per user and returns a stable levelOf across renders", async () => {
    await renderProbe();
    const first = hook().levelOf;

    await rerenderProbe();
    await rerenderProbe();

    expect(hook().levelOf).toBe(first);
    expect(mocks.loadPracticeState).toHaveBeenCalledTimes(1);
    expect(mocks.loadCefrTable).toHaveBeenCalledTimes(1);
  });

  it("drops the previous user's estimates and ignores their late response", async () => {
    const userOne = deferred<WordPracticeState>();
    const userTwo = deferred<WordPracticeState>();
    mocks.loadPracticeState.mockImplementation((uid: string) =>
      uid === "user-1" ? userOne.promise : userTwo.promise,
    );

    await renderProbe();
    mocks.useAuth.mockReturnValue({ user: { uid: "user-2" } });
    await rerenderProbe();

    await act(async () => {
      userTwo.resolve(practiceState({ "user two word": "B2" }));
    });
    await flushAsyncWork();
    await act(async () => {
      userOne.resolve(practiceState({ "user one word": "C1" }));
    });
    await flushAsyncWork();

    expect(mocks.loadPracticeState).toHaveBeenCalledWith("user-1");
    expect(mocks.loadPracticeState).toHaveBeenCalledWith("user-2");
    expect(hook().levelOf("user two word")).toEqual({ level: "B2", source: "ai" });
    expect(hook().levelOf("user one word")).toBeNull();
  });

  it("does not show the previous user's estimates while the next user is loading", async () => {
    const userTwo = deferred<WordPracticeState>();
    mocks.loadPracticeState.mockImplementation((uid: string) =>
      uid === "user-1"
        ? Promise.resolve(practiceState({ "user one word": "C1" }))
        : userTwo.promise,
    );

    await renderProbe();
    expect(hook().levelOf("user one word")).toEqual({ level: "C1", source: "ai" });

    mocks.useAuth.mockReturnValue({ user: { uid: "user-2" } });
    await rerenderProbe();

    expect(hook().ready).toBe(false);
    expect(hook().levelOf("user one word")).toBeNull();
    expect(hook().levelOf("run")).toEqual({ level: "A1", source: "list" });
  });

  it("ignores results that arrive after unmount", async () => {
    const table = deferred<CefrTable>();
    const state = deferred<WordPracticeState>();
    mocks.loadCefrTable.mockReturnValueOnce(table.promise);
    mocks.loadPracticeState.mockReturnValueOnce(state.promise);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderProbe();
    const rendersBeforeUnmount = renderCount;
    act(() => root?.unmount());
    root = null;
    await act(async () => {
      table.resolve(TABLE);
      state.resolve(practiceState({ "bona fide": "C2" }));
    });
    await flushAsyncWork();

    expect(renderCount).toBe(rendersBeforeUnmount);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("never calls a Gemini function to work out levels", async () => {
    await renderProbe();
    hook().levelOf("xyzzy");
    hook().levelOf("run");

    expect(mocks.generateGeminiContent).not.toHaveBeenCalled();
  });
});
