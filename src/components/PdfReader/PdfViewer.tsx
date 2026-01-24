import { memo, useRef, useState, useEffect, useCallback } from "react";
import { Document, Page } from "react-pdf";
import type { ExtractedPage, ReadingMode } from "../../types/pdf";
import { PageTextArea } from "./PageTextArea";
import { pdfDocumentOptions } from "../../utils/pdfConfig";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PdfViewerProps {
  url: string;
  pagesByNumber: Map<number, ExtractedPage>;
  readingMode: ReadingMode;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  onTextSelection: () => void;
  isLoadingAudio?: boolean;
  initialScrollPosition?: number | null;
  onScrollPositionChange?: (position: number) => void;
}

export const PdfViewer = memo(
  ({
    url,
    pagesByNumber,
    readingMode,
    onSpeak,
    onStopSpeaking,
    onTextSelection,
    isLoadingAudio,
    initialScrollPosition,
    onScrollPositionChange,
  }: PdfViewerProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pdfContainerRef = useRef<HTMLDivElement | null>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [numPages, setNumPages] = useState<number>(0);
    const [pdfWidth, setPdfWidth] = useState<number>(600);
    const [pdfReady, setPdfReady] = useState(false);
    const scrollRestoredRef = useRef(false);
    const currentUrlRef = useRef(url);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset state when URL changes
    useEffect(() => {
      if (currentUrlRef.current !== url) {
        currentUrlRef.current = url;
        scrollRestoredRef.current = false;
        setPdfReady(false);
        setNumPages(0);
      }
    }, [url]);

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

    // Measure the actual PDF container width (the card-body element)
    useEffect(() => {
      if (!pdfContainerRef.current) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          // Subtract padding and cap at reasonable limits
          const width = Math.floor(cr.width - 16);
          setPdfWidth(Math.max(300, Math.min(800, width)));
        }
      });
      ro.observe(pdfContainerRef.current);
      const rect = pdfContainerRef.current.getBoundingClientRect();
      const width = Math.floor(rect.width - 16);
      setPdfWidth(Math.max(300, Math.min(800, width)));
      return () => ro.disconnect();
    }, [numPages]); // Re-run when numPages changes (document loaded)

    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-3 bg-base-200 border-b border-black/5 dark:border-white/10 rounded-t-xl sticky top-0 z-10">
          <span className="text-sm font-medium text-base-content">PDF 預覽</span>
        </div>
        <div
          ref={containerRef}
          className="w-full flex-1 overflow-y-auto overflow-x-hidden rounded-b-xl p-3"
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
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                      <div className="xl:col-span-1">
                        <div
                          ref={pageNumber === 1 ? pdfContainerRef : undefined}
                          className="rounded-lg border border-black/5 dark:border-white/10 bg-base-100 shadow-sm max-w-full overflow-hidden"
                        >
                          <div className="p-2 sm:p-3">
                            {/* Disable the react-pdf text layer to keep the PDF text from duplicating after navigation */}
                            <Page
                              pageNumber={pageNumber}
                              width={pdfWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer
                              loading={
                                <div className="skeleton w-full h-[600px] rounded-lg" />
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="xl:col-span-1">
                        <PageTextArea
                          pageNumber={pageNumber}
                          text={pagesByNumber.get(pageNumber)?.text || ""}
                          readingMode={readingMode}
                          onSpeak={onSpeak}
                          onStopSpeaking={onStopSpeaking}
                          onTextSelection={onTextSelection}
                          isLoadingAudio={isLoadingAudio}
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
