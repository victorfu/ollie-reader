import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({
  renderWidths: [] as Array<number | undefined>,
  pdfJsText: "PDF.js extracted page text",
}));

vi.mock("react-pdf", async () => {
  const React = await import("react");

  return {
    pdfjs: { version: "test", GlobalWorkerOptions: { workerSrc: "" } },
    Document: ({
      children,
      onLoadSuccess,
    }: {
      children: React.ReactNode;
      onLoadSuccess: (result: { numPages: number }) => void;
    }) => {
      React.useEffect(() => onLoadSuccess({ numPages: 1 }), [onLoadSuccess]);
      return <div>{children}</div>;
    },
    Page: ({
      width,
      onGetTextSuccess,
      renderTextLayer,
    }: {
      width?: number;
      onGetTextSuccess?: (result: {
        items: Array<{ str: string; hasEOL: boolean }>;
      }) => void;
      renderTextLayer?: boolean;
    }) => {
      const didReportText = React.useRef(false);
      pdfMocks.renderWidths.push(width);
      React.useEffect(() => {
        if (!renderTextLayer || didReportText.current) return;
        didReportText.current = true;
        onGetTextSuccess?.({
          items: [{ str: pdfMocks.pdfJsText, hasEOL: false }],
        });
      }, [onGetTextSuccess, renderTextLayer]);
      return (
        <div data-testid="pdf-page" data-width={width ?? "unset"}>
          {renderTextLayer && (
            <div className="textLayer">
              <span>Learn proportional words</span>
            </div>
          )}
        </div>
      );
    },
  };
});

import { PdfViewer } from "./PdfViewer";

let host: HTMLDivElement;
let root: Root;
let scrollToMock: ReturnType<typeof vi.fn>;
let clientWidthDescriptor: PropertyDescriptor | undefined;

const defaultProps = {
  pagesByNumber: new Map(),
  onSpeak: vi.fn(),
  onTextSelection: vi.fn(),
};

function dispatchPointer(
  target: Element,
  type: "pointerdown" | "pointerup",
  x: number,
  y: number,
  pointerId = 1,
  button = 0,
  isPrimary = true,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  Object.defineProperty(event, "isPrimary", { value: isPrimary });
  target.dispatchEvent(event);
}

function renderViewer(
  url: string,
  initialScrollPosition: number | null,
  onScrollPositionChange = vi.fn(),
  overrides: Partial<React.ComponentProps<typeof PdfViewer>> = {},
) {
  act(() => {
    root.render(
      <PdfViewer
        {...defaultProps}
        url={url}
        initialScrollPosition={initialScrollPosition}
        onScrollPositionChange={onScrollPositionChange}
        {...overrides}
      />,
    );
  });
  return onScrollPositionChange;
}

function scrollContainer(): HTMLDivElement {
  const element = host.querySelector(".overflow-y-auto, .overflow-y-scroll");
  if (!(element instanceof HTMLDivElement)) {
    throw new Error("PDF scroll container was not rendered");
  }
  return element;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  pdfMocks.renderWidths.length = 0;
  scrollToMock = vi.fn();
  HTMLElement.prototype.scrollTo =
    scrollToMock as unknown as typeof HTMLElement.prototype.scrollTo;
  clientWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 760,
  });
  globalThis.ResizeObserver = class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback([], this as unknown as ResizeObserver);
    }
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "caretPositionFromPoint");
  Reflect.deleteProperty(document, "caretRangeFromPoint");
  window.getSelection()?.removeAllRanges();
  if (clientWidthDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientWidth",
      clientWidthDescriptor,
    );
  }
  host.remove();
});

describe("PdfViewer scroll management", () => {
  it("restores startup position inside the PDF container", () => {
    renderViewer("blob:cached", 420);

    act(() => vi.advanceTimersByTime(300));

    expect(scrollToMock).toHaveBeenCalledWith({ top: 420, left: 0 });
  });

  it("starts a newly selected course at the top", () => {
    renderViewer("blob:first", 420);
    act(() => vi.advanceTimersByTime(300));
    scrollToMock.mockClear();

    renderViewer("blob:next-course", null);

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0 });
    expect(scrollToMock).not.toHaveBeenCalledWith({ top: 420, left: 0 });
  });

  it("saves the PDF container position instead of the window position", () => {
    const onScrollPositionChange = renderViewer("blob:course", null);
    const container = scrollContainer();
    container.scrollTop = 275;

    act(() => container.dispatchEvent(new Event("scroll", { bubbles: true })));
    act(() => vi.advanceTimersByTime(500));

    expect(onScrollPositionChange).toHaveBeenCalledWith(275);
  });

  it("cancels a pending scroll write when the PDF changes", () => {
    const onScrollPositionChange = renderViewer("blob:first", null);
    const container = scrollContainer();
    container.scrollTop = 275;
    act(() => container.dispatchEvent(new Event("scroll", { bubbles: true })));

    renderViewer("blob:second", null, onScrollPositionChange);
    act(() => vi.advanceTimersByTime(500));

    expect(onScrollPositionChange).not.toHaveBeenCalled();
  });
});

describe("PdfViewer PDF-only layout", () => {
  it("renders only the PDF and prefers backend text for page actions", () => {
    const backendText = "Backend side panel text";
    const onSpeak = vi.fn();
    renderViewer("blob:pdf-only", null, vi.fn(), {
      pagesByNumber: new Map([
        [
          1,
          {
            page_number: 1,
            text: backendText,
            text_length: backendText.length,
          },
        ],
      ]),
      onSpeak,
    });

    const speakButton = host.querySelector<HTMLButtonElement>(
      '[aria-label="朗讀第 1 頁"]',
    );
    expect(host.querySelector('[data-testid="pdf-page"]')).not.toBeNull();
    expect(host.textContent).not.toContain(backendText);
    expect(speakButton).not.toBeNull();
    expect(
      host.querySelector('[aria-label="複製 Page 1 的 AI 學習提示"]'),
    ).not.toBeNull();

    act(() => speakButton?.click());
    expect(onSpeak).toHaveBeenCalledWith(backendText);
  });

  it("does not mount a PDF page before a concrete width is measured", () => {
    renderViewer("blob:measured", null);

    expect(pdfMocks.renderWidths.length).toBeGreaterThan(0);
    expect(pdfMocks.renderWidths).not.toContain(undefined);
    expect(
      host.querySelector('[data-testid="pdf-page"]')?.getAttribute("data-width"),
    ).toBe("760");
  });

  it("falls back to PDF.js text when backend text is unavailable", async () => {
    const onSpeak = vi.fn();
    renderViewer("blob:fallback", null, vi.fn(), {
      onSpeak,
    });

    await act(async () => Promise.resolve());
    const speakButton = host.querySelector<HTMLButtonElement>(
      '[aria-label="朗讀第 1 頁"]',
    );
    expect(speakButton?.disabled).toBe(false);
    act(() => speakButton?.click());
    expect(onSpeak).toHaveBeenCalledWith(pdfMocks.pdfJsText);
  });
});

describe("PdfViewer text-layer interaction", () => {
  it("turns a short click into a real single-word selection", () => {
    const onTextSelection = vi.fn();
    renderViewer("blob:click-word", null, vi.fn(), { onTextSelection });
    const surface = host.querySelector('[data-pdf-page-surface="true"]');
    const textNode = host.querySelector(".textLayer span")?.firstChild;
    if (!surface || !(textNode instanceof Text)) {
      throw new Error("mock PDF text layer was not rendered");
    }
    Object.defineProperty(document, "caretPositionFromPoint", {
      configurable: true,
      value: vi.fn(() => ({ offsetNode: textNode, offset: 10 })),
    });

    act(() => {
      dispatchPointer(surface, "pointerdown", 20, 30);
      dispatchPointer(surface, "pointerup", 20, 30);
    });

    expect(window.getSelection()?.toString()).toBe("proportional");
    expect(onTextSelection).toHaveBeenCalledTimes(1);
  });

  it("preserves a native drag selection without running caret hit testing", () => {
    const onTextSelection = vi.fn();
    const caretPositionFromPoint = vi.fn();
    renderViewer("blob:drag-selection", null, vi.fn(), { onTextSelection });
    const surface = host.querySelector('[data-pdf-page-surface="true"]');
    const textNode = host.querySelector(".textLayer span")?.firstChild;
    if (!surface || !(textNode instanceof Text)) {
      throw new Error("mock PDF text layer was not rendered");
    }
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 18);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    Object.defineProperty(document, "caretPositionFromPoint", {
      configurable: true,
      value: caretPositionFromPoint,
    });

    act(() => {
      dispatchPointer(surface, "pointerdown", 10, 30);
      dispatchPointer(surface, "pointerup", 80, 30);
    });

    expect(window.getSelection()?.toString()).toBe("Learn proportional");
    expect(caretPositionFromPoint).not.toHaveBeenCalled();
    expect(onTextSelection).toHaveBeenCalledTimes(1);
  });

  it("ignores secondary-button clicks", () => {
    const onTextSelection = vi.fn();
    const caretPositionFromPoint = vi.fn();
    renderViewer("blob:right-click", null, vi.fn(), { onTextSelection });
    const surface = host.querySelector('[data-pdf-page-surface="true"]');
    if (!surface) throw new Error("mock PDF surface was not rendered");
    Object.defineProperty(document, "caretPositionFromPoint", {
      configurable: true,
      value: caretPositionFromPoint,
    });

    act(() => {
      dispatchPointer(surface, "pointerdown", 20, 30, 1, 2);
      dispatchPointer(surface, "pointerup", 20, 30, 1, 2);
    });

    expect(caretPositionFromPoint).not.toHaveBeenCalled();
    expect(onTextSelection).not.toHaveBeenCalled();
  });
});
