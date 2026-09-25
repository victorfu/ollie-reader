import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingChanges } from "./autosaveQueue";
import { useAutosave } from "./useAutosave";

let container: HTMLDivElement;
let root: Root;
let controls: ReturnType<typeof useAutosave> | null = null;

function Harness({ commit }: { commit: (changes: PendingChanges) => Promise<void> }) {
  const autosave = useAutosave({ commit, persistedIds: [] });
  useEffect(() => {
    controls = autosave;
  });
  return <span data-status={autosave.status} />;
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  controls = null;
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility("visible");
  container.remove();
});

describe("useAutosave", () => {
  it("saves immediately when the page becomes hidden", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(<Harness commit={commit} />);
    });
    act(() => controls?.markUpsert("a"));

    setVisibility("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(commit).toHaveBeenCalledWith({ upsertIds: ["a"], deleteIds: [], sourceDirty: false });
    expect(container.querySelector("span")?.dataset.status).toBe("saved");
    act(() => root.unmount());
  });

  it("saves pending changes on unmount", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(<Harness commit={commit} />);
    });
    act(() => controls?.markSourceDirty());

    await act(async () => {
      root.unmount();
    });

    expect(commit).toHaveBeenCalledWith({ upsertIds: [], deleteIds: [], sourceDirty: true });
  });
});
