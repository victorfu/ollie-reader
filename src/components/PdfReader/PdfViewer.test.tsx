import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({
  renderWidths: [] as Array<number | undefined>,
  pdfJsText: "PDF.js extracted page text",
  pdfJsItems: null as Array<{ str: string; hasEOL: boolean }> | null,
  pdfJsLang: null as string | null,
  renderTextLayerValues: [] as Array<boolean | undefined>,
  // Left null so pages report no size at all, as they did before fitting.
  pageDimensions: null as {
    originalWidth: number;
    originalHeight: number;
  } | null,
  // When set, pages report a rendered canvas and text layer for this proxy.
  pageProxy: null as {
    pageNumber: number;
    commonObjs: { has(name: string): boolean; get(name: string): unknown };
  } | null,
  textLayerSuccessHandlers: [] as Array<(() => void) | undefined>,
}));

const fitMocks = vi.hoisted(() => ({ fitTextLayerRuns: vi.fn() }));

vi.mock("../../utils/pdfTextLayerFit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/pdfTextLayerFit")>()),
  fitTextLayerRuns: fitMocks.fitTextLayerRuns,
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
      pageNumber,
      width,
      onGetTextSuccess,
      onLoadSuccess,
      onRenderSuccess,
      onRenderTextLayerSuccess,
      renderTextLayer,
      children,
    }: {
      pageNumber: number;
      width?: number;
      onGetTextSuccess?: (result: {
        items: Array<{ str: string; hasEOL: boolean }>;
        lang: string | null;
      }) => void;
      onLoadSuccess?: (result: {
        pageNumber: number;
        originalWidth: number;
        originalHeight: number;
      }) => void;
      onRenderSuccess?: (page: unknown) => void;
      onRenderTextLayerSuccess?: () => void;
      renderTextLayer?: boolean;
      children?: React.ReactNode;
    }) => {
      const didReportText = React.useRef(false);
      const didReportSize = React.useRef(false);
      pdfMocks.renderWidths.push(width);
      pdfMocks.renderTextLayerValues.push(renderTextLayer);
      pdfMocks.textLayerSuccessHandlers.push(onRenderTextLayerSuccess);
      React.useEffect(() => {
        const dimensions = pdfMocks.pageDimensions;
        if (!dimensions || !onLoadSuccess || didReportSize.current) return;
        didReportSize.current = true;
        onLoadSuccess({ pageNumber, ...dimensions });
      }, [onLoadSuccess, pageNumber]);
      React.useEffect(() => {
        if (!renderTextLayer || didReportText.current) return;
        didReportText.current = true;
        onGetTextSuccess?.({
          items: pdfMocks.pdfJsItems ?? [
            { str: pdfMocks.pdfJsText, hasEOL: false },
          ],
          lang: pdfMocks.pdfJsLang,
        });
        if (pdfMocks.pageProxy) {
          onRenderSuccess?.(pdfMocks.pageProxy);
          onRenderTextLayerSuccess?.();
        }
      }, [
        onGetTextSuccess,
        onRenderSuccess,
        onRenderTextLayerSuccess,
        renderTextLayer,
      ]);
      return (
        <div data-testid="pdf-page" data-width={width ?? "unset"}>
          {renderTextLayer && (
            <div className="textLayer">
              <span>Learn proportional words</span>
            </div>
          )}
          <div className="annotationLayer">
            <a href="https://example.com" data-testid="pdf-annotation-link">
              annotation
            </a>
          </div>
          {children}
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
let clientHeightDescriptor: PropertyDescriptor | undefined;
let measuredClientWidth: number;
let measuredClientHeight: number;
let resizeCallbacks: ResizeObserverCallback[];

const defaultProps = {
  onSpeak: vi.fn(),
  onTextSelection: vi.fn(),
};

function dispatchPointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
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
  pdfMocks.renderTextLayerValues.length = 0;
  pdfMocks.textLayerSuccessHandlers.length = 0;
  fitMocks.fitTextLayerRuns.mockClear();
  scrollToMock = vi.fn();
  HTMLElement.prototype.scrollTo =
    scrollToMock as unknown as typeof HTMLElement.prototype.scrollTo;
  clientWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
  clientHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientHeight",
  );
  measuredClientWidth = 760;
  measuredClientHeight = 0;
  resizeCallbacks = [];
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => measuredClientWidth,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => measuredClientHeight,
  });
  globalThis.ResizeObserver = class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      resizeCallbacks.push(callback);
    }
    observe() {
      this.callback([], this as unknown as ResizeObserver);
    }
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
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
  pdfMocks.pageDimensions = null;
  pdfMocks.pdfJsItems = null;
  pdfMocks.pdfJsLang = null;
  pdfMocks.pageProxy = null;
  if (clientWidthDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientWidth",
      clientWidthDescriptor,
    );
  }
  if (clientHeightDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientHeight",
      clientHeightDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
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
  it("does not mount a PDF page before a concrete width is measured", () => {
    renderViewer("blob:measured", null);

    expect(pdfMocks.renderWidths.length).toBeGreaterThan(0);
    expect(pdfMocks.renderWidths).not.toContain(undefined);
    expect(
      host.querySelector('[data-testid="pdf-page"]')?.getAttribute("data-width"),
    ).toBe("760");
  });

  it("uses the PDF.js text layer for page actions", async () => {
    const onSpeak = vi.fn();
    renderViewer("blob:pdfjs-text", null, vi.fn(), {
      onSpeak,
    });

    await act(async () => Promise.resolve());
    const speakButton = host.querySelector<HTMLButtonElement>(
      '[aria-label="朗讀第 1 頁"]',
    );
    expect(host.querySelector('[data-testid="pdf-page"]')).not.toBeNull();
    expect(
      host.querySelector('[aria-label="複製 Page 1 的 AI 學習提示"]'),
    ).not.toBeNull();
    expect(speakButton?.disabled).toBe(false);
    act(() => speakButton?.click());
    expect(onSpeak).toHaveBeenCalledWith(pdfMocks.pdfJsText);
  });

  it("joins PDF.js text runs as stored, so split words stay whole", async () => {
    // PDF.js already includes word spaces in its runs; some PDFs store a word
    // one glyph per run (e.g. "IRS.gov/Spanish"), which must not gain spaces.
    pdfMocks.pdfJsItems = [
      { str: "• ", hasEOL: false },
      { str: "I", hasEOL: false },
      { str: "R", hasEOL: false },
      { str: "S", hasEOL: false },
      { str: ".gov (English)", hasEOL: true },
      { str: "Learn more", hasEOL: false },
    ];
    const onSpeak = vi.fn();
    renderViewer("blob:split-runs", null, vi.fn(), { onSpeak });

    await act(async () => Promise.resolve());
    act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="朗讀第 1 頁"]')
        ?.click(),
    );
    expect(onSpeak).toHaveBeenCalledWith("• IRS.gov (English)\nLearn more");
  });

  // PDF.js sizes every text-layer run by measuring it on a canvas tagged with
  // the PDF's /Lang ("" when absent). If the spans resolve their generic font
  // under a different lang, every run is stretched to the wrong width and the
  // selection drifts away from the drawn glyphs.
  it("gives the text layer the PDF's own language", async () => {
    pdfMocks.pdfJsLang = "zh-TW";
    renderViewer("blob:lang", null);

    await act(async () => Promise.resolve());
    const textLayer = host.querySelector(".textLayer");
    expect(textLayer?.closest("[lang]")?.getAttribute("lang")).toBe("zh-TW");
  });

  it("re-lays the rendered text layer from the page's real font widths", async () => {
    const font = { toUnicode: { _map: ["A"] }, widths: [722] };
    pdfMocks.pageProxy = {
      pageNumber: 1,
      commonObjs: {
        has: (name) => name === "g_d0_f1",
        get: () => font,
      },
    };
    renderViewer("blob:fit", null);

    await act(async () => Promise.resolve());
    expect(fitMocks.fitTextLayerRuns).toHaveBeenCalled();
    const [layer, items, getAdvances, options] =
      fitMocks.fitTextLayerRuns.mock.calls.at(-1)!;
    expect(layer).toBe(host.querySelector(".textLayer"));
    expect(items).toEqual([{ str: pdfMocks.pdfJsText, hasEOL: false }]);
    expect(getAdvances("g_d0_f1").get("A")).toBe(722);
    expect(getAdvances("g_d0_f9")).toBeNull();
    expect(options).toEqual({ lang: "" });
  });

  // react-pdf re-renders the whole text layer whenever this callback changes.
  it("keeps each page's text-layer callback stable across renders", async () => {
    renderViewer("blob:stable", null);
    await act(async () => Promise.resolve());
    renderViewer("blob:stable", null, vi.fn());

    const handlers = pdfMocks.textLayerSuccessHandlers.filter(Boolean);
    expect(handlers.length).toBeGreaterThan(1);
    expect(new Set(handlers).size).toBe(1);
  });

  it("keeps the app's language off a text layer whose PDF has no /Lang", async () => {
    document.documentElement.lang = "en";
    renderViewer("blob:no-lang", null);

    await act(async () => Promise.resolve());
    const textLayer = host.querySelector(".textLayer");
    expect(textLayer?.closest("[lang]")?.getAttribute("lang")).toBe("");
    document.documentElement.removeAttribute("lang");
  });
});

describe("PdfViewer page fitting", () => {
  it("narrows a page so a whole one fits a short scroll box", async () => {
    measuredClientWidth = 944;
    measuredClientHeight = 536; // 440 left once the page chrome is subtracted
    pdfMocks.pageDimensions = { originalWidth: 1280, originalHeight: 720 };

    renderViewer("blob:short-box", null);
    await act(async () => Promise.resolve());

    expect(
      host.querySelector('[data-testid="pdf-page"]')?.getAttribute("data-width"),
    ).toBe("782");
  });

  it("keeps the full column width when a page already fits", async () => {
    measuredClientWidth = 944;
    measuredClientHeight = 1000;
    pdfMocks.pageDimensions = { originalWidth: 1280, originalHeight: 720 };

    renderViewer("blob:tall-box", null);
    await act(async () => Promise.resolve());

    expect(
      host.querySelector('[data-testid="pdf-page"]')?.getAttribute("data-width"),
    ).toBe("944");
  });

  it("renders header actions in place of the default title", () => {
    renderViewer("blob:header", null, vi.fn(), {
      headerActions: <button type="button">上傳 PDF</button>,
    });

    expect(host.textContent).toContain("上傳 PDF");
    expect(host.textContent).not.toContain("PDF 預覽");
  });
});

describe("PdfViewer text-layer interaction", () => {
  it("keeps PDF annotation clicks out of word selection", () => {
    const onTextSelection = vi.fn();
    renderViewer("blob:annotation", null, vi.fn(), { onTextSelection });
    const annotation = host.querySelector('[data-testid="pdf-annotation-link"]');
    if (!annotation) throw new Error("annotation was not rendered");

    act(() => {
      dispatchPointer(annotation, "pointerdown", 190, 260);
      dispatchPointer(annotation, "pointerup", 190, 260);
    });

    expect(onTextSelection).not.toHaveBeenCalled();
  });

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

describe("PdfViewer width changes", () => {
  function notifyResize() {
    for (const callback of resizeCallbacks) {
      callback([], {} as ResizeObserver);
    }
  }

  it("coalesces a burst of observer resizes into one page re-render", () => {
    renderViewer("blob:resizing", null);
    const rendersAfterMount = pdfMocks.renderWidths.length;
    expect(pdfMocks.renderWidths.at(-1)).toBe(760);

    // Dragging the vocabulary dock's grip narrows the PDF column on every
    // pointermove; each one would otherwise re-rasterize every mounted page.
    act(() => {
      for (const width of [700, 660, 620, 580, 540]) {
        measuredClientWidth = width;
        notifyResize();
      }
    });
    expect(pdfMocks.renderWidths.length).toBe(rendersAfterMount);

    act(() => vi.advanceTimersByTime(120));

    expect(pdfMocks.renderWidths.length).toBeGreaterThan(rendersAfterMount);
    expect(pdfMocks.renderWidths.at(-1)).toBe(540);
  });

  it("keeps the reading position when the column is narrowed", () => {
    renderViewer("blob:reading-position", null);
    const container = scrollContainer();
    // jsdom has no layout, so stand in for it on this element only: the
    // document is a quarter shorter once the pages have re-rendered narrower,
    // which is exactly the window between capturing and restoring.
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get: () => (pdfMocks.renderWidths.at(-1) === 540 ? 6_000 : 8_000),
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      get: () => 800,
    });
    container.scrollTop = 2_000;
    scrollToMock.mockClear();

    act(() => {
      measuredClientWidth = 540;
      notifyResize();
    });
    act(() => vi.advanceTimersByTime(120));

    // A quarter of the way in before, a quarter of the way in after.
    expect(scrollToMock).toHaveBeenCalledWith({ top: 1_500, left: 0 });
  });

  it("leaves the top of the document alone when the width changes", () => {
    renderViewer("blob:at-top", null);
    const container = scrollContainer();
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get: () => 8_000,
    });
    container.scrollTop = 0;
    scrollToMock.mockClear();

    act(() => {
      measuredClientWidth = 540;
      notifyResize();
    });
    act(() => vi.advanceTimersByTime(120));

    // Nothing to preserve, so the restore never runs and cannot fight the
    // initialScrollPosition path.
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("measures the first width synchronously so pages can mount", () => {
    measuredClientWidth = 640;
    renderViewer("blob:first-measure", null);

    // No timer advance: the initial measurement must not be debounced.
    expect(pdfMocks.renderWidths.at(-1)).toBe(640);
  });
});
