import { memo, useRef, useState, useEffect, useCallback } from "react";
import { Document, Page } from "react-pdf";
import type { ExtractedPage, ReadingMode } from "../../types/pdf";
import { PageTextArea } from "./PageTextArea";

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
  }: PdfViewerProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [numPages, setNumPages] = useState<number>(0);
    const [containerWidth, setContainerWidth] = useState<number>(800);
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          setContainerWidth(Math.max(320, Math.floor(cr.width - 24)));
        }
      });
      ro.observe(containerRef.current);
      const rect = containerRef.current.getBoundingClientRect();
      setContainerWidth(Math.max(320, Math.floor(rect.width - 24)));
      return () => ro.disconnect();
    }, []);

    const handleScroll = useCallback(() => {
      if (!containerRef.current || numPages === 0) return;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        /* noop: keep for future metrics or lazy-loading hooks */
      });
    }, [numPages]);

    useEffect(() => {
      return () => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      };
    }, []);

    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-3 bg-base-200 rounded-t-lg sticky top-0 z-10">
          <span className="text-sm font-medium">PDF 預覽</span>
        </div>
        <div
          ref={containerRef}
          className="w-full flex-1 overflow-y-auto overflow-x-hidden rounded-b-lg p-3"
          style={{ minHeight: "800px", height: "800px" }}
          onScroll={handleScroll}
        >
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <div className="w-full h-64 grid place-items-center text-base-content/60">
                載入 PDF 中...
              </div>
            }
            error={<div className="alert alert-error m-3">PDF 載入失敗</div>}
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
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
                      <div className="xl:col-span-3">
                        <div className="card bg-base-100 shadow-md max-w-full overflow-hidden">
                          <div className="card-body p-2 sm:p-3">
                            {/* Disable the react-pdf text layer to keep the PDF text from duplicating after navigation */}
                            <Page
                              pageNumber={pageNumber}
                              width={containerWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer
                              loading={
                                <div className="skeleton w-full h-[600px]" />
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="xl:col-span-2">
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
