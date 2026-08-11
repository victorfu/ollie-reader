import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioRecorder } from "./useAudioRecorder";

type AudioRecorderHook = ReturnType<typeof useAudioRecorder>;

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

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static deferStop = false;

  readonly stream: MediaStream;
  readonly mimeType = "audio/mp4";
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
    MockMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  pause() {
    this.state = "paused";
  }

  resume() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    if (!MockMediaRecorder.deferStop) this.finishStop();
  }

  finishStop() {
    this.ondataavailable?.({
      data: new Blob(["recording"], { type: this.mimeType }),
    } as BlobEvent);
    this.onstop?.(new Event("stop"));
  }
}

function createStream() {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
  return { stream, stop };
}

let root: Root | null;
let host: HTMLDivElement | null;
let currentHook: AudioRecorderHook | null;
let getUserMedia: ReturnType<typeof vi.fn>;
let originalMediaRecorder: typeof MediaRecorder | undefined;
let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;
let originalMediaDevices: PropertyDescriptor | undefined;

function Probe() {
  const recorder = useAudioRecorder();
  useEffect(() => {
    currentHook = recorder;
  });
  return null;
}

function hook(): AudioRecorderHook {
  if (!currentHook) throw new Error("Recorder hook did not render");
  return currentHook;
}

async function mountHook() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(<Probe />);
  });
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  root = null;
  host = null;
  currentHook = null;
  MockMediaRecorder.instances = [];
  MockMediaRecorder.deferStop = false;
  getUserMedia = vi.fn();

  originalMediaDevices = Object.getOwnPropertyDescriptor(
    navigator,
    "mediaDevices",
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  originalMediaRecorder = globalThis.MediaRecorder;
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: MockMediaRecorder,
  });
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:recording"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });

  await mountHook();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  if (originalMediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
  if (originalMediaRecorder) {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: originalMediaRecorder,
    });
  } else {
    Reflect.deleteProperty(globalThis, "MediaRecorder");
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

describe("useAudioRecorder lifecycle", () => {
  it("closes a microphone granted after the recorder unmounts", async () => {
    const permission = deferred<MediaStream>();
    const { stream, stop } = createStream();
    getUserMedia.mockReturnValue(permission.promise);

    let startPromise!: Promise<boolean>;
    act(() => {
      startPromise = hook().startRecording();
    });
    act(() => root?.unmount());
    root = null;

    permission.resolve(stream);
    await expect(startPromise).resolves.toBe(false);

    expect(stop).toHaveBeenCalledOnce();
    expect(MockMediaRecorder.instances).toHaveLength(0);
  });

  it("invalidates a pending permission request when reset", async () => {
    const permission = deferred<MediaStream>();
    const { stream, stop } = createStream();
    getUserMedia.mockReturnValue(permission.promise);

    let startPromise!: Promise<boolean>;
    act(() => {
      startPromise = hook().startRecording();
      hook().resetRecording();
    });
    permission.resolve(stream);
    await act(async () => {
      await startPromise;
    });

    expect(stop).toHaveBeenCalledOnce();
    expect(MockMediaRecorder.instances).toHaveLength(0);
    expect(hook().isRecording).toBe(false);
    expect(hook().isStarting).toBe(false);
    expect(hook().audioBlob).toBeNull();
  });

  it("invalidates a pending permission request when stopped", async () => {
    const permission = deferred<MediaStream>();
    const { stream, stop } = createStream();
    getUserMedia.mockReturnValue(permission.promise);

    let startPromise!: Promise<boolean>;
    act(() => {
      startPromise = hook().startRecording();
      hook().stopRecording();
    });
    permission.resolve(stream);
    await act(async () => {
      await startPromise;
    });

    expect(stop).toHaveBeenCalledOnce();
    expect(MockMediaRecorder.instances).toHaveLength(0);
    expect(hook().isRecording).toBe(false);
    expect(hook().audioBlob).toBeNull();
  });

  it("locks duplicate starts while microphone permission is pending", async () => {
    const permission = deferred<MediaStream>();
    const { stream, stop } = createStream();
    getUserMedia.mockReturnValue(permission.promise);

    let firstStart!: Promise<boolean>;
    let duplicateStart!: Promise<boolean>;
    act(() => {
      firstStart = hook().startRecording();
      duplicateStart = hook().startRecording();
    });

    expect(hook().isStarting).toBe(true);
    expect(getUserMedia).toHaveBeenCalledOnce();
    await expect(duplicateStart).resolves.toBe(false);

    act(() => hook().resetRecording());
    permission.resolve(stream);
    await expect(firstStart).resolves.toBe(false);
    expect(stop).toHaveBeenCalledOnce();
    expect(hook().isStarting).toBe(false);
  });

  it("returns a visible, retryable error when microphone access is rejected", async () => {
    getUserMedia.mockRejectedValueOnce(
      new DOMException("denied", "NotAllowedError"),
    );

    let started = true;
    await act(async () => {
      started = await hook().startRecording();
    });

    expect(started).toBe(false);
    expect(hook().isStarting).toBe(false);
    expect(hook().error).toContain("麥克風權限被拒絕");

    const { stream } = createStream();
    getUserMedia.mockResolvedValueOnce(stream);
    await act(async () => {
      started = await hook().startRecording();
    });
    expect(started).toBe(true);
    expect(hook().isRecording).toBe(true);
    expect(hook().error).toBeNull();
  });

  it("preserves pause, resume, stop, and the recorder's real MIME type", async () => {
    const { stream, stop } = createStream();
    getUserMedia.mockResolvedValue(stream);

    let started = false;
    await act(async () => {
      started = await hook().startRecording();
    });
    expect(started).toBe(true);
    expect(hook().isRecording).toBe(true);

    act(() => hook().pauseRecording());
    expect(hook().isPaused).toBe(true);
    act(() => hook().resumeRecording());
    expect(hook().isPaused).toBe(false);

    act(() => hook().stopRecording());

    expect(stop).toHaveBeenCalledOnce();
    expect(hook().isRecording).toBe(false);
    expect(hook().audioBlob?.type).toBe("audio/mp4");
    expect(hook().audioUrl).toBe("blob:recording");
  });

  it("keeps save-time state finalizing until MediaRecorder emits stop", async () => {
    MockMediaRecorder.deferStop = true;
    const { stream } = createStream();
    getUserMedia.mockResolvedValue(stream);
    await act(async () => {
      await hook().startRecording();
    });

    act(() => hook().stopRecording());
    expect(hook().isFinalizing).toBe(true);
    expect(hook().audioBlob).toBeNull();

    act(() => MockMediaRecorder.instances[0].finishStop());
    expect(hook().isFinalizing).toBe(false);
    expect(hook().audioBlob?.type).toBe("audio/mp4");
  });
});
