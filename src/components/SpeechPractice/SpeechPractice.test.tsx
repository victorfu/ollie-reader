import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeechPracticeTopic } from "../../types/speechPractice";

const mocks = vi.hoisted(() => ({
  resetTimer: vi.fn(),
  startTimer: vi.fn(),
  resetRecording: vi.fn(),
  startRecording: vi.fn(),
  saveRecord: vi.fn(),
  recorderSupported: false,
  recorderStarting: false,
  recorderError: null as string | null,
  timerTime: 1,
  topicA: {
    id: "topic-a",
    title: "Topic A",
    titleChinese: "主題 A",
    description: "A",
    descriptionChinese: "A",
    category: "general" as const,
    difficulty: "beginner" as const,
    suggestedTimeSeconds: 60,
  },
  topicB: {
    id: "topic-b",
    title: "Topic B",
    titleChinese: "主題 B",
    description: "B",
    descriptionChinese: "B",
    category: "general" as const,
    difficulty: "beginner" as const,
    suggestedTimeSeconds: 60,
  },
}));

vi.mock("../../hooks/useSpeechPractice", () => ({
  useSpeechPractice: () => ({
    records: [],
    loading: false,
    isLoadingMore: false,
    hasMoreRecords: false,
    topicCounts: new Map(),
    topicScripts: new Map([["topic-a", "A saved script"]]),
    loadMoreRecords: vi.fn(),
    saveRecord: mocks.saveRecord,
    deleteRecord: vi.fn(),
    saveScript: vi.fn(),
  }),
}));
vi.mock("../../hooks/useAudioRecorder", () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    isStarting: mocks.recorderStarting,
    isPaused: false,
    isFinalizing: false,
    recordingTime: 0,
    audioUrl: null,
    audioBlob: null,
    isSupported: mocks.recorderSupported,
    error: mocks.recorderError,
    startRecording: mocks.startRecording,
    stopRecording: vi.fn(),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    resetRecording: mocks.resetRecording,
  }),
}));
vi.mock("../../hooks/usePracticeTimer", () => ({
  usePracticeTimer: () => ({
    time: mocks.timerTime,
    isRunning: false,
    isPaused: false,
    start: mocks.startTimer,
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    reset: mocks.resetTimer,
  }),
}));
vi.mock("../../hooks/useScriptGenerator", () => ({
  useScriptGenerator: () => ({
    prompt: "",
    generatedScript: "",
    isGenerating: false,
    error: null,
    setPrompt: vi.fn(),
    setScript: vi.fn(),
    generateScript: vi.fn(),
    resetState: vi.fn(),
  }),
}));
vi.mock("./TopicSelector", () => ({
  TopicSelector: ({
    onSelect,
    onStartPractice,
  }: {
    onSelect: (topic: SpeechPracticeTopic) => void;
    onStartPractice: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelect(mocks.topicA)}>select-a</button>
      <button type="button" onClick={() => onSelect(mocks.topicB)}>select-b</button>
      <button type="button" onClick={onStartPractice}>start-practice</button>
    </div>
  ),
}));
vi.mock("./TimerDisplay", () => ({ TimerDisplay: () => null }));
vi.mock("./PracticeHistory", () => ({ PracticeHistory: () => null }));
vi.mock("./ScriptGeneratorModal", () => ({
  ScriptGeneratorModal: () => null,
}));
vi.mock("../common/Toast", () => ({
  Toast: ({ message }: { message: string }) => <div role="status">{message}</div>,
}));
vi.mock("../common/ConfirmModal", () => ({ ConfirmModal: () => null }));

import { SpeechPractice } from "./SpeechPractice";

let root: Root;
let host: HTMLDivElement;

function clickButton(label: string) {
  const button = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  act(() => button.click());
}

function rerender() {
  act(() => root.render(<SpeechPractice />));
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.recorderSupported = false;
  mocks.recorderStarting = false;
  mocks.recorderError = null;
  mocks.timerTime = 1;
  mocks.startRecording.mockResolvedValue(true);
  mocks.saveRecord.mockResolvedValue({ success: true, message: "saved" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<SpeechPractice />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("SpeechPractice topic script ownership", () => {
  it("clears the previous script when the next topic has no saved script", () => {
    clickButton("select-a");
    clickButton("start-practice");
    expect(host.textContent).toContain("A saved script");

    clickButton("放棄並返回");
    clickButton("select-b");
    clickButton("start-practice");

    expect(host.textContent).not.toContain("A saved script");
  });
});

describe("SpeechPractice recorder startup", () => {
  function openReadyPractice() {
    mocks.timerTime = 0;
    rerender();
    clickButton("select-a");
    clickButton("start-practice");
  }

  it("starts the timer only after microphone recording succeeds", async () => {
    let resolveStart!: (started: boolean) => void;
    const pendingStart = new Promise<boolean>((resolve) => {
      resolveStart = resolve;
    });
    mocks.recorderSupported = true;
    mocks.startRecording.mockReturnValueOnce(pendingStart);
    openReadyPractice();

    clickButton("開始練習");
    expect(mocks.startRecording).toHaveBeenCalledOnce();
    expect(mocks.startTimer).not.toHaveBeenCalled();
    resolveStart(true);
    await flushAsyncWork();

    expect(mocks.startTimer).toHaveBeenCalledOnce();
  });

  it("keeps timer-only practice for browsers without recording support", () => {
    mocks.recorderSupported = false;
    openReadyPractice();

    clickButton("開始練習");

    expect(mocks.startRecording).not.toHaveBeenCalled();
    expect(mocks.startTimer).toHaveBeenCalledOnce();
  });

  it("allows returning while permission is pending without later starting the timer", async () => {
    let resolveStart!: (started: boolean) => void;
    const pendingStart = new Promise<boolean>((resolve) => {
      resolveStart = resolve;
    });
    mocks.recorderSupported = true;
    mocks.startRecording.mockReturnValueOnce(pendingStart);
    openReadyPractice();

    clickButton("開始練習");
    mocks.recorderStarting = true;
    rerender();
    const startButton = [...host.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("啟動麥克風中"),
    );
    expect(startButton?.disabled).toBe(true);

    clickButton("返回");
    expect(mocks.resetRecording).toHaveBeenCalled();
    resolveStart(false);
    await flushAsyncWork();

    expect(mocks.startTimer).not.toHaveBeenCalled();
    expect(host.textContent).toContain("select-a");
  });

  it("shows a microphone rejection and leaves Start available for retry", () => {
    mocks.recorderSupported = true;
    openReadyPractice();
    mocks.recorderError = "麥克風權限被拒絕，請允許麥克風權限後重試";
    rerender();

    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("麥克風權限被拒絕");
    const startButton = [...host.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "開始練習",
    );
    expect(startButton?.disabled).toBe(false);
  });
});


describe("SpeechPractice save session ownership", () => {
  it("reports an older save failure with its topic while a newer save is pending", async () => {
    let resolveSave!: (result: { success: boolean; message: string }) => void;
    mocks.saveRecord
      .mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }))
      .mockReturnValueOnce(new Promise(() => {}));

    clickButton("select-a");
    clickButton("start-practice");
    clickButton("儲存練習記錄");
    clickButton("主題選擇");
    clickButton("select-b");
    clickButton("start-practice");
    clickButton("儲存練習記錄");
    const timerResets = mocks.resetTimer.mock.calls.length;
    const recorderResets = mocks.resetRecording.mock.calls.length;

    resolveSave({ success: false, message: "儲存失敗，請稍後再試" });
    await flushAsyncWork();

    expect(host.querySelector('[role="status"]')?.textContent)
      .toBe("「主題 A」：儲存失敗，請稍後再試");
    expect(host.textContent).toContain("主題 B");
    expect(host.textContent).toContain("儲存中");
    expect(mocks.resetTimer).toHaveBeenCalledTimes(timerResets);
    expect(mocks.resetRecording).toHaveBeenCalledTimes(recorderResets);
  });

  it("does not let an older save reset a newer practice", async () => {
    let resolveSave!: (result: { success: boolean; message: string }) => void;
    const pendingSave = new Promise<{ success: boolean; message: string }>((resolve) => {
      resolveSave = resolve;
    });
    mocks.saveRecord.mockReturnValueOnce(pendingSave);

    clickButton("select-a");
    clickButton("start-practice");
    clickButton("儲存練習記錄");

    clickButton("主題選擇");
    clickButton("select-b");
    clickButton("start-practice");
    const timerResetsAfterStartingB = mocks.resetTimer.mock.calls.length;
    const recorderResetsAfterStartingB = mocks.resetRecording.mock.calls.length;

    resolveSave({ success: true, message: "saved" });
    await flushAsyncWork();

    expect(host.textContent).toContain("主題 B");
    expect(mocks.resetTimer).toHaveBeenCalledTimes(timerResetsAfterStartingB);
    expect(mocks.resetRecording).toHaveBeenCalledTimes(recorderResetsAfterStartingB);
  });
});
