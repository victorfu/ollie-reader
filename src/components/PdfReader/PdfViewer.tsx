import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Volume2 } from "lucide-react";
import { Document, Page } from "react-pdf";
import type { TextSelectionPayload } from "../../hooks/useTextSelection";
import type { ExtractedPage } from "../../types/pdf";
import { pdfDocumentOptions } from "../../utils/pdfConfig";
import {
  computeRestoredScrollTop,
  computeScrollRatio,
} from "../../utils/pdfScrollPosition";
import {
  PAGE_CHROME_PX,
  computeFitPageWidth,
} from "../../utils/pdfPageFit";
import { selectWordAtPoint } from "../../utils/pdfTextSelection";
import { hasPdfWordGeometry } from "../../utils/pdfWordSelection";
import { Tooltip } from "../common/Tooltip";
import { CopyPagePromptButton } from "./CopyPagePromptButton";
import { WordOverlay } from "./WordOverlay";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PdfViewerProps {
  url: string;
  pagesByNumber: Map<number, ExtractedPage>;
  onSpeak: (text: string) => void;
  onTextSelection: (selection?: TextSelectionPayload) => void;
  isLoadingAudio?: boolean;
  isSpeaking?: boolean;
  initialScrollPosition?: number | null;
  onScrollPositionChange?: (position: number) => void;
  /**
   * Controls rendered inside the viewer's own header row. The reader puts its
   * upload controls here rather than in a bar of their own: a second bar costs
   * ~116px of viewport, which on a short screen is most of what stops a whole
   * page from being visible at once.
   */
  headerActions?: ReactNode;
}

type PointerStart = {
  pointerId: number;
  x: number;
  y: number;
};

const CLICK_DISTANCE_PX = 6;
const EMPTY_PDFJS_PAGES = new Map<number, string>();

/**
 * Trailing debounce for observer-driven width changes. Every mounted page is
 * re-rendered at the measured width, so a live drag of the vocabulary dock's
 * grip would otherwise re-rasterize the whole document on every pointermove.
 */
const WIDTH_SETTLE_MS = 120;

function isInteractiveAnnotationTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, [role='link'], .annotationLayer"))
  );
}

export const PdfViewer = memo(
  ({
    url,
    pagesByNumber,
    onSpeak,
    onTextSelection,
    isLoadingAudio,
    isSpeaking,
    initialScrollPosition,
    onScrollPositionChange,
    headerActions,
  }: PdfViewerProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const measureRef = useRef<HTMLDivElement | null>(null);
    const pointerStartRef = useRef<PointerStart | null>(null);
    const scrollRestoredRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const widthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const measuredWidthRef = useRef(0);
    const measuredHeightRef = useRef(0);
    const pendingScrollRatioRef = useRef<number | null>(null);
    const [documentState, setDocumentState] = useState({
      url,
      numPages: 0,
    });
    const [pdfReadyState, setPdfReadyState] = useState({
      url,
      ready: false,
    });
    const [columnMetrics, setColumnMetrics] = useState({
      width: 0,
      height: 0,
    });
    const [pageAspectState, setPageAspectState] = useState<{
      url: string;
      ratio: number | null;
    }>({ url, ratio: null });
    const [pdfJsPageState, setPdfJsPageState] = useState({
      url,
      pages: new Map<number, string>(),
    });

    const numPages = documentState.url === url ? documentState.numPages : 0;
    const pdfReady = pdfReadyState.url === url && pdfReadyState.ready;
    const pdfJsPages =
      pdfJsPageState.url === url ? pdfJsPageState.pages : EMPTY_PDFJS_PAGES;
    const pageAspectRatio =
      pageAspectState.url === url ? pageAspectState.ratio : null;

    // The width every page renders at: the column, unless the box is too short
    // to show a whole page at that width, in which case the height decides.
    const pdfPageWidth = useMemo(
      () =>
        computeFitPageWidth({
          columnWidth: columnMetrics.width,
          availableHeight: columnMetrics.height - PAGE_CHROME_PX,
          pageAspectRatio,
        }),
      [columnMetrics, pageAspectRatio],
    );

    // Measure a stable, capped single-column viewport before mounting any Page,
    // and the height of the box that has to show a whole page — the render
    // width is bounded by both.
    useLayoutEffect(() => {
      const column = measureRef.current;
      const container = containerRef.current;
      if (!column || !container) return;

      const updateMetrics = () => {
        const nextWidth = Math.floor(column.clientWidth);
        if (nextWidth <= 0) return;
        const nextHeight = Math.floor(container.clientHeight);
        const previousWidth = measuredWidthRef.current;
        const previousHeight = measuredHeightRef.current;
        if (previousWidth === nextWidth && previousHeight === nextHeight) return;

        // Re-rendering every page at a new size changes the document's total
        // height, so a preserved scrollTop would land somewhere else entirely.
        // Remember the position as a fraction and restore it after the commit.
        if (previousWidth > 0) {
          const ratio = computeScrollRatio(
            container.scrollTop,
            container.scrollHeight,
          );
          if (ratio > 0) pendingScrollRatioRef.current = ratio;
        }

        measuredWidthRef.current = nextWidth;
        measuredHeightRef.current = nextHeight;
        setColumnMetrics({ width: nextWidth, height: nextHeight });
      };

      const clearWidthTimer = () => {
        if (widthTimerRef.current) {
          clearTimeout(widthTimerRef.current);
          widthTimerRef.current = null;
        }
      };

      // The first measurement must not wait — no page can mount without it.
      updateMetrics();

      const scheduleMetricsUpdate = () => {
        clearWidthTimer();
        widthTimerRef.current = setTimeout(() => {
          widthTimerRef.current = null;
          updateMetrics();
        }, WIDTH_SETTLE_MS);
      };

      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(scheduleMetricsUpdate);
        observer.observe(column);
        observer.observe(container);
        return () => {
          observer.disconnect();
          clearWidthTimer();
        };
      }

      window.addEventListener("resize", scheduleMetricsUpdate);
      return () => {
        window.removeEventListener("resize", scheduleMetricsUpdate);
        clearWidthTimer();
      };
    }, []);

    useEffect(() => {
      scrollRestoredRef.current = false;
      pointerStartRef.current = null;
      pendingScrollRatioRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      containerRef.current?.scrollTo({ top: 0, left: 0 });
    }, [url]);

    const handleDocumentLoadSuccess = useCallback(
      ({ numPages: loadedPages }: { numPages: number }) => {
        setDocumentState((previous) =>
          previous.url === url && previous.numPages === loadedPages
            ? previous
            : { url, numPages: loadedPages },
        );
      },
      [url],
    );

    // Fitting needs the document's shape, which only the PDF itself knows. One
    // page is enough: a mixed-orientation document is fitted to its first page,
    // which is still far closer than not fitting at all.
    const handleFirstPageLoad = useCallback(
      ({
        originalWidth,
        originalHeight,
      }: {
        originalWidth: number;
        originalHeight: number;
      }) => {
        if (!originalWidth || !originalHeight) return;
        const ratio = originalWidth / originalHeight;
        setPageAspectState((previous) =>
          previous.url === url && previous.ratio === ratio
            ? previous
            : { url, ratio },
        );
      },
      [url],
    );

    const getPageText = useCallback(
      (pageNumber: number): string => {
        const backendText = pagesByNumber.get(pageNumber)?.text || "";
        return backendText.trim()
          ? backendText
          : pdfJsPages.get(pageNumber) || "";
      },
      [pagesByNumber, pdfJsPages],
    );

    const handleScroll = useCallback(() => {
      if (!onScrollPositionChange) return;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const container = containerRef.current;
        if (container) {
          onScrollPositionChange(container.scrollTop);
        }
        debounceTimerRef.current = null;
      }, 500);
    }, [onScrollPositionChange]);

    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (numPages <= 0 || pdfPageWidth <= 0 || pdfReady) return;
      const timer = setTimeout(
        () => setPdfReadyState({ url, ready: true }),
        300,
      );
      return () => clearTimeout(timer);
    }, [numPages, pdfPageWidth, pdfReady, url]);

    useEffect(() => {
      if (
        !pdfReady ||
        initialScrollPosition == null ||
        initialScrollPosition <= 0 ||
        scrollRestoredRef.current
      ) {
        return;
      }

      containerRef.current?.scrollTo({
        top: initialScrollPosition,
        left: 0,
      });
      scrollRestoredRef.current = true;
    }, [pdfReady, initialScrollPosition]);

    // Put the reader back where they were after a width change re-rendered
    // every page. Deliberately a passive effect, not a layout one: react-pdf
    // sizes each canvas from its own passive effect, and React flushes child
    // effects before parent ones — a layout effect here would still measure the
    // pre-resize scrollHeight and restore nothing.
    useEffect(() => {
      const ratio = pendingScrollRatioRef.current;
      pendingScrollRatioRef.current = null;
      if (ratio === null) return;

      const container = containerRef.current;
      if (!container) return;
      container.scrollTo({
        top: computeRestoredScrollTop(
          ratio,
          container.scrollHeight,
          container.clientHeight,
        ),
        left: 0,
      });
    }, [pdfPageWidth]);

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (
          event.button !== 0 ||
          event.isPrimary === false ||
          isInteractiveAnnotationTarget(event.target)
        ) {
          pointerStartRef.current = null;
          return;
        }
        pointerStartRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
      },
      [],
    );

    const handlePointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const start = pointerStartRef.current;
        pointerStartRef.current = null;
        if (!start || start.pointerId !== event.pointerId) return;
        if (
          event.button !== 0 ||
          event.isPrimary === false ||
          isInteractiveAnnotationTarget(event.target)
        ) {
          return;
        }

        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim()) {
          onTextSelection();
          return;
        }

        const distance = Math.hypot(
          event.clientX - start.x,
          event.clientY - start.y,
        );
        if (distance <= CLICK_DISTANCE_PX) {
          selectWordAtPoint(
            event.currentTarget,
            event.clientX,
            event.clientY,
          );
        }
        onTextSelection();
      },
      [onTextSelection],
    );

    return (
      <div className="flex h-full w-full flex-col">
        <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-t-xl border-b border-border-hairline bg-base-200/90 px-3 py-2 backdrop-blur-md">
          {headerActions ?? (
            <span className="text-sm font-medium text-base-content">
              PDF 預覽
            </span>
          )}
          <span className="hidden text-xs text-base-content/55 sm:inline">
            點擊單字，或拖曳選取片語與句子
          </span>
        </div>
        {/* `relative` is load-bearing, not decoration: a static scroll container
            is not a containing block, so the absolutely positioned layers
            react-pdf puts on every page resolve against the reader root
            instead. Those escape this box's clip entirely and add their full
            height — 12k pixels for a 16-page document — to the page's
            scrollable area, which is then draggable from anywhere outside the
            PDF. */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="relative min-h-0 w-full flex-1 overflow-x-auto overflow-y-scroll overscroll-contain rounded-b-xl p-3"
        >
          <div
            ref={measureRef}
            data-pdf-measure="true"
            className="mx-auto w-full max-w-5xl"
          >
            <Document
              key={url}
              file={url}
              onLoadSuccess={handleDocumentLoadSuccess}
              options={pdfDocumentOptions}
              loading={
                <div className="grid h-64 w-full place-items-center text-base-content/60">
                  <span className="loading loading-spinner loading-md text-primary" />
                  <span className="mt-2 text-sm">載入 PDF 中...</span>
                </div>
              }
              error={
                <div className="m-3 rounded-lg border border-error/20 bg-error/10 px-4 py-3">
                  <p className="text-sm text-error">PDF 載入失敗</p>
                </div>
              }
            >
              <div
                className="mx-auto flex flex-col gap-6"
                style={pdfPageWidth > 0 ? { width: pdfPageWidth } : undefined}
              >
                {Array.from({ length: numPages }, (_, index) => index + 1).map(
                  (pageNumber) => {
                    const extractedPage = pagesByNumber.get(pageNumber);
                    const pageText = getPageText(pageNumber);
                    const textAvailable = pageText.trim().length > 0;
                    const nativeWordGeometry = hasPdfWordGeometry(extractedPage);
                    return (
                      <section
                        key={`page-${pageNumber}`}
                        data-page-number={pageNumber}
                        className="overflow-visible rounded-xl bg-base-200/55 pt-2 shadow-soft"
                      >
                        <div className="mx-2 mb-2 flex min-h-11 flex-wrap items-center justify-between gap-2 px-2 py-1.5 sm:min-h-0">
                          <span className="rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                            Page {pageNumber}
                          </span>
                          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
                            <CopyPagePromptButton
                              pageNumber={pageNumber}
                              text={pageText}
                            />
                            <Tooltip content="朗讀此頁" position="bottom">
                              <button
                                type="button"
                                onClick={() => onSpeak(pageText)}
                                disabled={
                                  !textAvailable || isLoadingAudio || isSpeaking
                                }
                                className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-success/90 text-success-content shadow-sm transition-all duration-200 hover:bg-success active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 sm:h-8 sm:w-8"
                                aria-label={`朗讀第 ${pageNumber} 頁`}
                              >
                                {isLoadingAudio ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : (
                                  <Volume2
                                    className="size-4"
                                    strokeWidth={1.8}
                                  />
                                )}
                              </button>
                            </Tooltip>
                          </div>
                        </div>

                        <div
                          data-pdf-page-surface="true"
                          className="relative overflow-hidden rounded-lg bg-base-100 shadow-sm selection:bg-accent/25"
                          onPointerDown={handlePointerDown}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={() => {
                            pointerStartRef.current = null;
                          }}
                        >
                          {pdfPageWidth > 0 ? (
                            <Page
                              pageNumber={pageNumber}
                              width={pdfPageWidth}
                              renderTextLayer
                              renderAnnotationLayer
                              onLoadSuccess={
                                pageNumber === 1 ? handleFirstPageLoad : undefined
                              }
                              onGetTextSuccess={({ items }) => {
                                const pageTextFromPdf = items
                                  .map((item) => {
                                    if (!("str" in item)) return "";
                                    return `${item.str}${item.hasEOL ? "\n" : " "}`;
                                  })
                                  .join("")
                                  .trim();
                                setPdfJsPageState((previousState) => {
                                  const previous =
                                    previousState.url === url
                                      ? previousState.pages
                                      : EMPTY_PDFJS_PAGES;
                                  if (
                                    previous.get(pageNumber) === pageTextFromPdf
                                  ) {
                                    return previousState;
                                  }
                                  const next = new Map(previous);
                                  next.set(pageNumber, pageTextFromPdf);
                                  return { url, pages: next };
                                });
                              }}
                              loading={
                                <div className="skeleton h-150 w-full rounded-lg" />
                              }
                            >
                              {nativeWordGeometry && (
                                <WordOverlay
                                  pageWidth={extractedPage.width}
                                  pageHeight={extractedPage.height}
                                  words={extractedPage.words}
                                  onTextSelection={onTextSelection}
                                />
                              )}
                            </Page>
                          ) : (
                            <div className="skeleton h-150 w-full rounded-lg" />
                          )}
                        </div>
                      </section>
                    );
                  },
                )}
              </div>
            </Document>
          </div>
        </div>
      </div>
    );
  },
);

PdfViewer.displayName = "PdfViewer";
