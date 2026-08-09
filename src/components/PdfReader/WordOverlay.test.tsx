import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PdfWord } from "../../types/pdf";
import type { TextSelectionPayload } from "../../hooks/useTextSelection";
import { WordOverlay } from "./WordOverlay";

const words: PdfWord[] = [
  { text: "Once", x0: 20, y0: 20, x1: 70, y1: 40 },
  { text: "upon", x0: 80, y0: 20, x1: 130, y1: 40 },
  { text: "a", x0: 20, y0: 55, x1: 30, y1: 75 },
  { text: "time,", x0: 40, y0: 55, x1: 90, y1: 75 },
];

let host: HTMLDivElement;
let root: Root;

function pointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  x: number,
  y: number,
  pointerId = 1,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: true },
    pointerType: { value: "mouse" },
  });
  target.dispatchEvent(event);
}

function renderOverlay(onTextSelection = vi.fn()) {
  act(() => {
    root.render(
      <div className="relative" style={{ width: 1_000, height: 600 }}>
        <WordOverlay
          pageWidth={500}
          pageHeight={300}
          words={words}
          onTextSelection={onTextSelection}
        />
      </div>,
    );
  });
  const overlay = host.querySelector<HTMLElement>("[data-native-word-overlay]");
  if (!overlay) throw new Error("native word overlay was not rendered");
  let rect = {
    left: 100,
    top: 200,
    right: 1_100,
    bottom: 800,
    width: 1_000,
    height: 600,
    x: 100,
    y: 200,
    toJSON: () => ({}),
  };
  overlay.getBoundingClientRect = () => rect as DOMRect;
  return {
    overlay,
    onTextSelection,
    setRect: (next: typeof rect) => {
      rect = next;
    },
  };
}

function lastPayload(mock: ReturnType<typeof vi.fn>): TextSelectionPayload {
  const payloads = mock.mock.calls
    .map(([payload]) => payload as TextSelectionPayload | undefined)
    .filter((payload): payload is TextSelectionPayload => Boolean(payload));
  const payload = payloads.at(-1);
  if (!payload) throw new Error("no custom selection payload was emitted");
  return payload;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  window.getSelection()?.removeAllRanges();
  host.remove();
});

describe("WordOverlay", () => {
  it("keeps one hit-test root instead of rendering every word as a control", () => {
    const { overlay } = renderOverlay();

    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    expect(overlay.querySelectorAll("button")).toHaveLength(0);
    expect(overlay.querySelectorAll("[data-native-word-highlight]")).toHaveLength(
      0,
    );
  });

  it("selects a clicked word from its scaled PyMuPDF box", () => {
    const onTextSelection = vi.fn();
    const { overlay } = renderOverlay(onTextSelection);

    act(() => {
      pointer(overlay, "pointerdown", 190, 260);
      pointer(overlay, "pointerup", 190, 260);
    });

    const payload = lastPayload(onTextSelection);
    expect(payload.text).toBe("Once");
    expect(payload.getAnchorRect()).toMatchObject({
      left: 140,
      top: 240,
      right: 240,
      bottom: 280,
    });
    expect(
      overlay.querySelectorAll("[data-native-word-highlight]"),
    ).toHaveLength(1);

    act(() => payload.onClear());
    expect(
      overlay.querySelectorAll("[data-native-word-highlight]"),
    ).toHaveLength(0);
  });

  it("selects forward and reverse multi-line drags in reading order", () => {
    const onTextSelection = vi.fn();
    const { overlay } = renderOverlay(onTextSelection);

    act(() => {
      pointer(overlay, "pointerdown", 190, 260);
      pointer(overlay, "pointermove", 230, 330);
      pointer(overlay, "pointerup", 230, 330);
    });
    expect(lastPayload(onTextSelection).text).toBe("Once upon a time,");
    expect(
      overlay.querySelectorAll("[data-native-word-highlight]"),
    ).toHaveLength(4);

    act(() => {
      pointer(overlay, "pointerdown", 230, 330, 2);
      pointer(overlay, "pointermove", 190, 260, 2);
      pointer(overlay, "pointerup", 190, 260, 2);
    });
    expect(lastPayload(onTextSelection).text).toBe("Once upon a time,");
  });

  it("replaces an existing selection on the same page with one click", () => {
    let activeSelection: TextSelectionPayload | null = null;
    const onTextSelection = vi.fn((payload?: TextSelectionPayload) => {
      if (payload) {
        activeSelection = payload;
        return;
      }
      activeSelection?.onClear();
      activeSelection = null;
    });
    const { overlay } = renderOverlay(onTextSelection);

    act(() => {
      pointer(overlay, "pointerdown", 190, 260);
      pointer(overlay, "pointerup", 190, 260);
    });
    expect((activeSelection as TextSelectionPayload | null)?.text).toBe("Once");

    act(() => {
      pointer(overlay, "pointerdown", 310, 260, 2);
      pointer(overlay, "pointerup", 310, 260, 2);
    });

    expect((activeSelection as TextSelectionPayload | null)?.text).toBe("upon");
    expect(
      overlay.querySelectorAll("[data-native-word-highlight]"),
    ).toHaveLength(1);
  });

  it("uses the live root rectangle after a responsive resize", () => {
    const onTextSelection = vi.fn();
    const { overlay, setRect } = renderOverlay(onTextSelection);
    setRect({
      left: 20,
      top: 40,
      right: 520,
      bottom: 340,
      width: 500,
      height: 300,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    });

    act(() => {
      pointer(overlay, "pointerdown", 65, 70);
      pointer(overlay, "pointerup", 65, 70);
    });

    expect(lastPayload(onTextSelection).text).toBe("Once");
    expect(lastPayload(onTextSelection).getAnchorRect()).toMatchObject({
      left: 40,
      top: 60,
      right: 90,
      bottom: 80,
    });
  });

  it("does not commit a cancelled pointer gesture", () => {
    const onTextSelection = vi.fn();
    const { overlay } = renderOverlay(onTextSelection);

    act(() => {
      pointer(overlay, "pointerdown", 190, 260);
      pointer(overlay, "pointercancel", 230, 330);
    });

    expect(
      onTextSelection.mock.calls.some(([payload]) => Boolean(payload)),
    ).toBe(false);
    expect(
      overlay.querySelectorAll("[data-native-word-highlight]"),
    ).toHaveLength(0);
  });
});
