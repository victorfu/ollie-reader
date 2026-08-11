import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: {
    ttsMode: "api" as "api" | "browser",
    ttsEngine: "piper" as const,
    speechRate: 1,
  },
  updateTtsMode: vi.fn(),
  fetchWithComputeBase: vi.fn(),
  getCacheKey: vi.fn((text: string) => text),
  getPendingRequest: vi.fn(),
  setPendingRequest: vi.fn(),
  getCache: vi.fn(),
  setCache: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

vi.mock("../hooks/useSettings", () => ({
  useSettings: () => ({
    ...mocks.settings,
    updateTtsMode: mocks.updateTtsMode,
  }),
}));
vi.mock("../services/localBackend", () => ({
  fetchWithComputeBase: mocks.fetchWithComputeBase,
}));
vi.mock("../services/ttsCache", () => ({
  ttsCache: {
    getCacheKey: mocks.getCacheKey,
    getPendingRequest: mocks.getPendingRequest,
    setPendingRequest: mocks.setPendingRequest,
    get: mocks.getCache,
    set: mocks.setCache,
  },
}));
vi.mock("../utils/apiUtil", () => ({ apiFetch: vi.fn() }));

import { useSpeechState } from "../hooks/useSpeechState";
import type { SpeechContextType } from "./SpeechContextType";
import { SpeechProvider } from "./SpeechContext";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class MockAudio {
  static instances: MockAudio[] = [];

  readonly src: string;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

class MockUtterance {
  readonly text: string;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

let root: Root | null;
let host: HTMLDivElement | null;
let currentSpeech: SpeechContextType | null;
let spokenUtterances: MockUtterance[];
let cancelSpeech: ReturnType<typeof vi.fn>;
let originalAudio: PropertyDescriptor | undefined;
let originalUtterance: PropertyDescriptor | undefined;
let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;
let originalSpeechSynthesis: PropertyDescriptor | undefined;

function Probe() {
  const speech = useSpeechState();
  useEffect(() => {
    currentSpeech = speech;
  });
  return null;
}

function speech(): SpeechContextType {
  if (!currentSpeech) throw new Error("Speech context did not render");
  return currentSpeech;
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mountProvider() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <SpeechProvider>
        <Probe />
      </SpeechProvider>,
    );
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.settings.ttsMode = "api";
  mocks.getPendingRequest.mockReturnValue(null);
  mocks.setCache.mockResolvedValue(undefined);
  root = null;
  host = null;
  currentSpeech = null;
  MockAudio.instances = [];
  spokenUtterances = [];
  cancelSpeech = vi.fn();

  originalAudio = Object.getOwnPropertyDescriptor(globalThis, "Audio");
  originalUtterance = Object.getOwnPropertyDescriptor(
    globalThis,
    "SpeechSynthesisUtterance",
  );
  originalSpeechSynthesis = Object.getOwnPropertyDescriptor(
    window,
    "speechSynthesis",
  );
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: MockAudio,
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: MockUtterance,
  });
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      cancel: cancelSpeech,
      getVoices: vi.fn(() => []),
      speak: vi.fn((utterance: MockUtterance) => {
        spokenUtterances.push(utterance);
      }),
      onvoiceschanged: null,
    },
  });

  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: mocks.createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: mocks.revokeObjectURL,
  });
});

afterEach(() => {
  vi.useRealTimers();
  if (root) act(() => root?.unmount());
  host?.remove();
  if (originalAudio) Object.defineProperty(globalThis, "Audio", originalAudio);
  else Reflect.deleteProperty(globalThis, "Audio");
  if (originalUtterance) {
    Object.defineProperty(
      globalThis,
      "SpeechSynthesisUtterance",
      originalUtterance,
    );
  } else {
    Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
  }
  if (originalSpeechSynthesis) {
    Object.defineProperty(window, "speechSynthesis", originalSpeechSynthesis);
  } else {
    Reflect.deleteProperty(window, "speechSynthesis");
  }
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "createObjectURL");
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "revokeObjectURL");
  }
});

describe("SpeechProvider request ownership", () => {
  it("does not let an older cache lookup start after the latest speech", async () => {
    const oldLookup = deferred<Blob | null>();
    const oldBlob = new Blob(["old"]);
    const latestBlob = new Blob(["latest"]);
    mocks.getCache.mockImplementation((key: string) =>
      key === "old" ? oldLookup.promise : Promise.resolve(latestBlob),
    );
    mocks.createObjectURL.mockImplementation((blob: Blob) =>
      blob === oldBlob ? "blob:old" : "blob:latest",
    );
    await mountProvider();

    act(() => speech().speak("old"));
    act(() => speech().speak("latest"));
    await flushPromises();

    expect(MockAudio.instances.map((audio) => audio.src)).toEqual([
      "blob:latest",
    ]);

    oldLookup.resolve(oldBlob);
    await flushPromises();
    expect(MockAudio.instances.map((audio) => audio.src)).toEqual([
      "blob:latest",
    ]);
  });

  it("retries a same-key request instead of inheriting the stopped request's abort", async () => {
    const latestBlob = new Blob(["latest"]);
    let pendingRequest: Promise<Blob> | null = null;
    mocks.getCache.mockResolvedValue(null);
    mocks.getPendingRequest.mockImplementation(() => pendingRequest);
    mocks.setPendingRequest.mockImplementation(
      (_key: string, request: Promise<Blob>) => {
        pendingRequest = request;
      },
    );
    mocks.fetchWithComputeBase
      .mockImplementationOnce(
        (_path: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener("abort", () => {
              reject(options.signal?.reason);
            });
          }),
      )
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => latestBlob,
      });
    mocks.createObjectURL.mockReturnValue("blob:latest");
    await mountProvider();

    act(() => speech().speak("same"));
    await flushPromises();
    expect(mocks.fetchWithComputeBase).toHaveBeenCalledTimes(1);

    act(() => speech().speak("same"));
    await flushPromises();

    expect(mocks.fetchWithComputeBase).toHaveBeenCalledTimes(2);
    expect(MockAudio.instances.map((audio) => audio.src)).toEqual([
      "blob:latest",
    ]);
  });

  it("settles superseded async speech and clears its old timeout", async () => {
    vi.useFakeTimers();
    const firstBlob = new Blob(["first"]);
    const secondBlob = new Blob(["second"]);
    mocks.getCache.mockImplementation((key: string) =>
      Promise.resolve(key === "first" ? firstBlob : secondBlob),
    );
    mocks.createObjectURL.mockImplementation((blob: Blob) =>
      blob === firstBlob ? "blob:first" : "blob:second",
    );
    await mountProvider();

    const first = speech().speakAsync("first");
    await flushPromises();
    const firstAudio = MockAudio.instances[0];
    act(() => vi.advanceTimersByTime(20_000));

    const second = speech().speakAsync("second");
    await first;
    await flushPromises();
    const secondAudio = MockAudio.instances[1];

    expect(firstAudio.pause).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(10_000));
    expect(secondAudio.pause).not.toHaveBeenCalled();

    act(() => secondAudio.onended?.());
    await second;
  });

  it("stops API audio and settles its promise when the provider unmounts", async () => {
    const blob = new Blob(["api"]);
    mocks.getCache.mockResolvedValue(blob);
    mocks.createObjectURL.mockReturnValue("blob:api");
    await mountProvider();

    const playback = speech().speakAsync("api");
    await flushPromises();
    const audio = MockAudio.instances[0];

    act(() => root?.unmount());
    root = null;
    await playback;

    expect(audio.pause).toHaveBeenCalledOnce();
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:api");
  });

  it("keeps browser speech synthesis and resolves on its natural end", async () => {
    mocks.settings.ttsMode = "browser";
    await mountProvider();

    const playback = speech().speakAsync("browser speech");
    expect(spokenUtterances).toHaveLength(1);
    act(() => spokenUtterances[0].onend?.());

    await expect(playback).resolves.toBeUndefined();
    expect(speech().isSpeaking).toBe(false);
  });
});
