import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Volume2 } from "lucide-react";
import { Document, Page } from "react-pdf";
import type { ExtractedPage } from "../../types/pdf";
import { pdfDocumentOptions } from "../../utils/pdfConfig";
import { selectWordAtPoint } from "../../utils/pdfTextSelection";
import { ExternalAssistantToolbar } from "./ExternalAssistantToolbar";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PdfViewerProps {
  url: string;
  pagesByNumber: Map<number, ExtractedPage>;
  onSpeak: (text: string) => void;
  onTextSelection: () => void;
  isLoadingAudio?: boolean;
  isSpeaking?: boolean;
  initialScrollPosition?: number | null;
  onScrollPositionChange?: (position: number) => void;
}

type PointerStart = {
  pointerId: number;
  x: number;
  y: number;
};

const CLICK_DISTANCE_PX = 6;
const EMPTY_PDFJS_PAGES = new Map<number, string>();

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
  }: PdfViewerProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const measureRef = useRef<HTMLDivElement | null>(null);
    const pointerStartRef = useRef<PointerStart | null>(null);
    const scrollRestoredRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [documentState, setDocumentState] = useState({
      url,
      numPages: 0,
    });
    const [pdfReadyState, setPdfReadyState] = useState({
      url,
      ready: false,
    });
    const [pdfPageWidth, setPdfPageWidth] = useState(0);
    const [pdfJsPageState, setPdfJsPageState] = useState({
      url,
      pages: new Map<number, string>(),
    });

    const numPages = documentState.url === url ? documentState.numPages : 0;
    const pdfReady = pdfReadyState.url === url && pdfReadyState.ready;
    const pdfJsPages =
      pdfJsPageState.url === url ? pdfJsPageState.pages : EMPTY_PDFJS_PAGES;

    // Measure a stable, capped single-column viewport before mounting any Page.
    useLayoutEffect(() => {
      const target = measureRef.current;
      if (!target) return;

      const updateWidth = () => {
        const nextWidth = Math.floor(target.clientWidth);
        if (nextWidth <= 0) return;
        setPdfPageWidth((previousWidth) =>
          previousWidth === nextWidth ? previousWidth : nextWidth,
        );
      };

      updateWidth();
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(updateWidth);
        observer.observe(target);
        return () => observer.disconnect();
      }

      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }, []);

    useEffect(() => {
      scrollRestoredRef.current = false;
      pointerStartRef.current = null;
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
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-border-hairline bg-base-200/90 p-3 backdrop-blur-md">
          <span className="text-sm font-medium text-base-content">PDF 預覽</span>
          <span className="text-xs text-base-content/55">
            點擊單字，或拖曳選取片語與句子
          </span>
        </div>
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-[calc(100dvh-11rem)] min-h-96 w-full flex-1 overflow-x-auto overflow-y-scroll rounded-b-xl p-3 sm:min-h-[32rem] lg:h-[800px] lg:min-h-[800px]"
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
              <div className="flex flex-col gap-6">
                {Array.from({ length: numPages }, (_, index) => index + 1).map(
                  (pageNumber) => {
                    const pageText = getPageText(pageNumber);
                    const textAvailable = pageText.trim().length > 0;
                    return (
                      <section
                        key={`page-${pageNumber}`}
                        data-page-number={pageNumber}
                        className="overflow-visible rounded-xl bg-base-200/55 pt-2 shadow-soft"
                      >
                        <div className="sticky top-2 z-20 mx-2 mb-2 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-border-hairline bg-base-100/92 px-2 py-1.5 shadow-lg backdrop-blur-xl sm:min-h-0">
                          <span className="rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                            Page {pageNumber}
                          </span>
                          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
                            <ExternalAssistantToolbar
                              pageNumber={pageNumber}
                              text={pageText}
                            />
                            <button
                              type="button"
                              onClick={() => onSpeak(pageText)}
                              disabled={
                                !textAvailable || isLoadingAudio || isSpeaking
                              }
                              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-success/90 px-3 text-xs font-semibold text-success-content shadow-sm transition-all duration-200 hover:bg-success active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 sm:h-8"
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
                              <span className="hidden sm:inline">朗讀此頁</span>
                            </button>
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
                            />
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
