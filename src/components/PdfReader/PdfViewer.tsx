import { memo, useRef, useState, useEffect, useCallback } from "react";
import { Document, Page } from "react-pdf";
import type {
  ExtractedPage,
  ReadingMode,
  TextParsingMode,
} from "../../types/pdf";
import { PageTextArea } from "./PageTextArea";
import { pdfDocumentOptions } from "../../utils/pdfConfig";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PdfViewerProps {
  url: string;
  pagesByNumber: Map<number, ExtractedPage>;
  readingMode: ReadingMode;
  onSpeak: (text: string) => void;
  onTextSelection: () => void;
  isLoadingAudio?: boolean;
  isSpeaking?: boolean;
  initialScrollPosition?: number | null;
  onScrollPositionChange?: (position: number) => void;
  textParsingMode?: TextParsingMode;
}

export const PdfViewer = memo(
  ({
    url,
    pagesByNumber,
    readingMode,
    onSpeak,
    onTextSelection,
    isLoadingAudio,
    isSpeaking,
    initialScrollPosition,
    onScrollPositionChange,
    textParsingMode = "backend",
  }: PdfViewerProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [numPages, setNumPages] = useState<number>(0);
    const [pdfReady, setPdfReady] = useState(false);
    const [pdfPageWidth, setPdfPageWidth] = useState<number>(0);
    const scrollRestoredRef = useRef(false);
    const currentUrlRef = useRef(url);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Frontend extracted text (when textParsingMode === "frontend")
    const [frontendPages, setFrontendPages] = useState<Map<number, string>>(new Map());

    // Reset state when URL changes
    useEffect(() => {
      if (currentUrlRef.current !== url) {
        currentUrlRef.current = url;
        scrollRestoredRef.current = false;
        setPdfReady(false);
        setNumPages(0);
        setPdfPageWidth(0);
        setFrontendPages(new Map());
      }
    }, [url]);

    // Keep PDF page width synced with preview column width so large PDFs always fit.
    useEffect(() => {
      if (numPages <= 0) return;

      const container = containerRef.current;
      if (!container) return;

      const measureTarget = container.querySelector<HTMLDivElement>(
        '[data-pdf-measure="true"]',
      );
      if (!measureTarget) return;

      const updateWidth = () => {
        const nextWidth = Math.floor(measureTarget.clientWidth);
        if (nextWidth <= 0) return;

        setPdfPageWidth((prevWidth) =>
          prevWidth === nextWidth ? prevWidth : nextWidth,
        );
      };

      updateWidth();

      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
          updateWidth();
        });
        observer.observe(measureTarget);
        return () => observer.disconnect();
      }

      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }, [numPages]);

    // Helper to get page text based on parsing mode
    const getPageText = useCallback((pageNumber: number): string => {
      if (textParsingMode === "frontend") {
        return frontendPages.get(pageNumber) || "";
      }
      return pagesByNumber.get(pageNumber)?.text || "";
    }, [textParsingMode, frontendPages, pagesByNumber]);

    // Debounced scroll position save (window level)
    const handleScroll = useCallback(() => {
      if (!onScrollPositionChange) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onScrollPositionChange(window.scrollY);
      }, 500);
    }, [onScrollPositionChange]);

    // Listen to window scroll events
    useEffect(() => {
      if (!onScrollPositionChange) return;

      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, [handleScroll, onScrollPositionChange]);

    // Mark PDF as ready after pages are rendered
    useEffect(() => {
      if (numPages > 0 && !pdfReady) {
        // Wait for PDF pages to be rendered
        const timer = setTimeout(() => {
          setPdfReady(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [numPages, pdfReady]);

    // Restore scroll position after PDF is ready (window level)
    useEffect(() => {
      if (
        pdfReady &&
        initialScrollPosition != null &&
        initialScrollPosition > 0 &&
        !scrollRestoredRef.current
      ) {
        window.scrollTo(0, initialScrollPosition);
        scrollRestoredRef.current = true;
      }
    }, [pdfReady, initialScrollPosition]);

    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-3 bg-base-200 border-b border-black/5 dark:border-white/10 rounded-t-xl sticky top-0 z-10">
          <span className="text-sm font-medium text-base-content">PDF 預覽</span>
        </div>
        <div
          ref={containerRef}
          className="w-full flex-1 overflow-y-auto overflow-x-auto rounded-b-xl p-3"
          style={{ minHeight: "800px", height: "800px" }}
        >
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            options={pdfDocumentOptions}
            loading={
              <div className="w-full h-64 grid place-items-center text-base-content/60">
                <span className="loading loading-spinner loading-md text-primary"></span>
                <span className="mt-2 text-sm">載入 PDF 中...</span>
              </div>
            }
            error={
              <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 m-3">
                <p className="text-sm text-error">PDF 載入失敗</p>
              </div>
            }
          >
            <div className="flex flex-col items-stretch gap-6">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <div
                    key={`page-wrap-${pageNumber}`}
                    ref={(el) => {
                      pageRefs.current[pageNumber - 1] = el;
                    }}
                    data-page-number={pageNumber}
                    className="rounded-lg"
                  >
                    <div className="grid gap-4 items-start grid-cols-1 xl:grid-cols-[11fr_9fr]">
                      <div className="xl:col-span-1">
                        <div
                          className="relative rounded-lg border border-black/5 dark:border-white/10 bg-base-100 shadow-sm overflow-hidden"
                        >
                          {/* Speak page button overlay */}
                          <div className="absolute top-3 left-3 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const text = getPageText(pageNumber);
                                if (text) onSpeak(text);
                              }}
                              disabled={isLoadingAudio || isSpeaking}
                              className={`w-8 h-8 rounded-lg shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${
                                isSpeaking
                                  ? "bg-base-300/90 text-base-content"
                                  : "bg-success/90 hover:bg-success text-success-content"
                              }`}
                              title={`朗讀第 ${pageNumber} 頁`}
                            >
                              {isLoadingAudio ? (
                                <span className="loading loading-spinner loading-xs"></span>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                          <div
                            className="p-2 sm:p-3 select-text cursor-text"
                            onMouseUp={onTextSelection}
                            onTouchEnd={onTextSelection}
                          >
                            <div
                              className="relative w-full"
                              data-pdf-measure={pageNumber === 1 ? "true" : undefined}
                            >
                              <Page
                                pageNumber={pageNumber}
                                width={pdfPageWidth || undefined}
                                renderTextLayer={true}
                                renderAnnotationLayer
                                onGetTextSuccess={({ items }) => {
                                  // Extract page text from react-pdf
                                  const pageText = items
                                    .map((item) => {
                                      if (!("str" in item)) return "";
                                      return item.str + (item.hasEOL ? "\n" : " ");
                                    })
                                    .join("")
                                    .trim();

                                  // Store frontend extracted text
                                  setFrontendPages((prev) => {
                                    const next = new Map(prev);
                                    next.set(pageNumber, pageText);
                                    return next;
                                  });

                                  console.log(`[PDF Page ${pageNumber}] Frontend extracted:`, pageText.slice(0, 50));
                                }}
                                loading={
                                  <div className="skeleton w-full h-150 rounded-lg" />
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="xl:col-span-1">
                        <PageTextArea
                          pageNumber={pageNumber}
                          text={getPageText(pageNumber)}
                          readingMode={readingMode}
                          onSpeak={onSpeak}
                          onTextSelection={onTextSelection}
                          isLoadingAudio={isLoadingAudio}
                          isSpeaking={isSpeaking}
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </Document>
        </div>
      </div>
    );
  },
);

PdfViewer.displayName = "PdfViewer";
