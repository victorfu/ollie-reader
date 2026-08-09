import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useTextSelection,
  type TextSelectionPayload,
} from "./useTextSelection";

type HookValue = ReturnType<typeof useTextSelection>;

let host: HTMLDivElement;
let root: Root;
let current: HookValue;

function Harness() {
  const value = useTextSelection();
  useLayoutEffect(() => {
    current = value;
  }, [value]);
  return null;
}

function renderHook(): void {
  act(() => root.render(<Harness />));
}

function selectionPayload(
  onClear = vi.fn(),
  getAnchorRect: TextSelectionPayload["getAnchorRect"] = () => ({
    left: 100,
    top: 200,
    right: 180,
    bottom: 220,
    width: 80,
    height: 20,
  }),
): TextSelectionPayload {
  return { text: "Once upon", getAnchorRect, onClear };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  renderHook();
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  window.getSelection()?.removeAllRanges();
  host.remove();
});

describe("useTextSelection custom PDF selections", () => {
  it("uses a live native-word anchor rectangle for the floating toolbar", () => {
    act(() => current.handleTextSelection(selectionPayload()));

    expect(current.selectedText).toBe("Once upon");
    expect(current.toolbarPosition).toEqual({
      top: 184,
      left: 180,
      placement: "above",
    });
  });

  it("repositions from the anchor getter after a nested PDF scroll", () => {
    let top = 200;
    act(() =>
      current.handleTextSelection(
        selectionPayload(vi.fn(), () => ({
          left: 400,
          top,
          right: 480,
          bottom: top + 20,
          width: 80,
          height: 20,
        })),
      ),
    );

    top = 80;
    act(() => window.dispatchEvent(new Event("scroll")));

    expect(current.toolbarPosition).toEqual({
      top: 116,
      left: 440,
      placement: "below",
    });
  });

  it("clears the overlay highlight together with toolbar state", () => {
    const onClear = vi.fn();
    act(() => current.handleTextSelection(selectionPayload(onClear)));

    act(() => current.clearSelection());

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(current.selectedText).toBe("");
    expect(current.toolbarPosition).toBeNull();
  });

  it("copies a custom selection when no browser Range exists", () => {
    act(() => current.handleTextSelection(selectionPayload()));
    const setData = vi.fn();
    const copyEvent = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(copyEvent, "clipboardData", {
      value: { setData },
    });

    act(() => document.dispatchEvent(copyEvent));

    expect(copyEvent.defaultPrevented).toBe(true);
    expect(setData).toHaveBeenCalledWith("text/plain", "Once upon");
  });
});
