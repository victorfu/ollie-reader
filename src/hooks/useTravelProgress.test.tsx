import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TravelProgress } from "../services/travelProgressService";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "user-1" } as { uid: string } | null },
  getOrCreateTravelProgress: vi.fn(),
  saveTravelMissionStep: vi.fn(),
  saveTravelMissionCompletion: vi.fn(),
}));

vi.mock("./useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../services/travelProgressService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/travelProgressService")>();
  return {
    ...actual,
    getOrCreateTravelProgress: mocks.getOrCreateTravelProgress,
    saveTravelMissionStep: mocks.saveTravelMissionStep,
    saveTravelMissionCompletion: mocks.saveTravelMissionCompletion,
  };
});

import { useTravelProgress } from "./useTravelProgress";

type TravelHook = ReturnType<typeof useTravelProgress>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function progress(uid: string): TravelProgress {
  return {
    uid,
    stamps: {
      airport: { completedAt: 10, stars: 3, attempts: 1 },
    },
    inProgress: {},
    totalCompleted: 1,
    createdAt: 1,
    updatedAt: 10,
  };
}

function renderHook() {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  let current: TravelHook | null = null;

  function Harness() {
    const value = useTravelProgress();
    useEffect(() => {
      current = value;
    });
    return null;
  }

  act(() => root.render(<Harness />));
  return {
    get current() {
      if (!current) throw new Error("travel hook did not render");
      return current;
    },
    rerender() {
      act(() => root.render(<Harness />));
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("useTravelProgress", () => {
  let hook: ReturnType<typeof renderHook> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { uid: "user-1" };
    mocks.saveTravelMissionStep.mockResolvedValue(undefined);
    mocks.saveTravelMissionCompletion.mockResolvedValue(undefined);
  });

  afterEach(() => {
    hook?.unmount();
    hook = null;
  });

  it("waits for authoritative progress before saving an early mission action", async () => {
    const initial = deferred<TravelProgress>();
    mocks.getOrCreateTravelProgress.mockReturnValueOnce(initial.promise);
    hook = renderHook();

    act(() => hook?.current.markStep("hotel", "word"));
    expect(mocks.saveTravelMissionStep).not.toHaveBeenCalled();

    initial.resolve(progress("user-1"));
    await flushAsyncWork();

    expect(mocks.saveTravelMissionStep).toHaveBeenCalledWith(
      "user-1",
      "hotel",
      "word",
      expect.any(Number),
    );
    expect(hook.current.progress).toEqual(
      expect.objectContaining({
        uid: "user-1",
        stamps: expect.objectContaining({
          airport: expect.objectContaining({ attempts: 1 }),
        }),
        inProgress: expect.objectContaining({
          hotel: expect.objectContaining({ step: "word" }),
        }),
      }),
    );
  });

  it("does not replace a new account with a late previous-account load", async () => {
    const alice = deferred<TravelProgress>();
    mocks.getOrCreateTravelProgress.mockReturnValueOnce(alice.promise);
    hook = renderHook();

    mocks.auth.user = { uid: "user-2" };
    mocks.getOrCreateTravelProgress.mockResolvedValueOnce(progress("user-2"));
    hook.rerender();
    await flushAsyncWork();
    expect(hook.current.progress?.uid).toBe("user-2");

    alice.resolve(progress("user-1"));
    await flushAsyncWork();
    expect(hook.current.progress?.uid).toBe("user-2");
    expect(mocks.saveTravelMissionStep).not.toHaveBeenCalled();
  });

  it("does not create an empty save when the initial load fails", async () => {
    const initial = deferred<TravelProgress>();
    mocks.getOrCreateTravelProgress.mockReturnValueOnce(initial.promise);
    hook = renderHook();
    act(() => hook?.current.markStep("hotel", "word"));

    initial.reject(new Error("offline"));
    await flushAsyncWork();

    expect(mocks.saveTravelMissionStep).not.toHaveBeenCalled();
    expect(hook.current.progress).toBeNull();
    expect(hook.current.error).toContain("無法同步");
  });
});
