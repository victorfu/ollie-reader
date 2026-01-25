import { memo, useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Document, Page } from "react-pdf";
import type {
  ExtractedPage,
  ReadingMode,
  WordPosition,
} from "../../types/pdf";
import { PageTextArea } from "./PageTextArea";
import { WordOverlay } from "./WordOverlay";
import { WordToolbar } from "./WordToolbar";
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
  isSpeaking?: boolean;
  initialScrollPosition?: number | null;
  onScrollPositionChange?: (position: number) => void;
  onPageTextExtracted?: (pageNumber: number, text: string) => void;
  onWordLookup?: (word: string) => Promise<string | null>;
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
    isSpeaking,
    initialScrollPosition,
    onScrollPositionChange,
    onPageTextExtracted,
    onWordLookup,
  }: PdfViewerProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [numPages, setNumPages] = useState<number>(0);
    const [pdfReady, setPdfReady] = useState(false);
    const scrollRestoredRef = useRef(false);
    const currentUrlRef = useRef(url);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Word overlay state
    const [wordPositions, setWordPositions] = useState<Map<number, WordPosition[]>>(new Map());
    const [activeWord, setActiveWord] = useState<{
      word: string;
      position: { top: number; left: number };
    } | null>(null);
    const [wordDefinition, setWordDefinition] = useState<string | null>(null);
    const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);

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

    // Extract word positions from rendered TextLayer spans
    const extractWordPositionsFromDOM = useCallback((pageNumber: number, pageContainer: HTMLElement) => {
      // 如果已經處理過這一頁，跳過以避免無限迴圈
      if (wordPositions.has(pageNumber)) return;

      const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) return;

      const WORD_REGEX = /[A-Za-z]+(?:[''-][A-Za-z]+)*/g;
      const containerRect = textLayer.getBoundingClientRect();
      const words: WordPosition[] = [];

      // Get all text spans in the TextLayer
      const spans = textLayer.querySelectorAll('span');
      spans.forEach((span) => {
        const text = span.textContent || '';
        if (!text.trim()) return;

        const spanRect = span.getBoundingClientRect();
        const spanStyle = window.getComputedStyle(span);
        const fontSize = parseFloat(spanStyle.fontSize) || 12;

        // Find English words in this span
        let match;
        WORD_REGEX.lastIndex = 0;
        while ((match = WORD_REGEX.exec(text)) !== null) {
          // Estimate character width
          const avgCharWidth = spanRect.width / text.length;
          const charOffset = match.index;

          words.push({
            word: match[0],
            x: spanRect.left - containerRect.left + charOffset * avgCharWidth,
            y: spanRect.top - containerRect.top,
            width: match[0].length * avgCharWidth,
            height: fontSize * 1.2,
          });
        }
      });

      if (words.length > 0) {
        console.log(`[PDF Page ${pageNumber}] Extracted ${words.length} word positions from DOM`);
        setWordPositions((prev) => {
          const next = new Map(prev);
          next.set(pageNumber, words);
          return next;
        });
      }
    }, [wordPositions]);

    // Handle word click from overlay - just show popup, no auto actions
    const handleWordClick = useCallback(
      (word: string, rect: DOMRect) => {
        setActiveWord({
          word,
          position: {
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2,
          },
        });
        setWordDefinition(null);
        setIsLoadingDefinition(false);
      },
      [],
    );

    // Handle word lookup from toolbar
    const handleWordLookup = useCallback(
      async (word: string) => {
        if (!onWordLookup) return;
        setIsLoadingDefinition(true);
        try {
          const definition = await onWordLookup(word);
          setWordDefinition(definition);
        } catch (error) {
          console.error("Failed to lookup word:", error);
          setWordDefinition("查詢失敗");
        } finally {
          setIsLoadingDefinition(false);
        }
      },
      [onWordLookup],
    );

    // Close word toolbar
    const handleCloseWordToolbar = useCallback(() => {
      setActiveWord(null);
      setWordDefinition(null);
    }, []);

    // Close toolbar when clicking outside
    useEffect(() => {
      if (!activeWord) return;

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".word-toolbar")) {
          handleCloseWordToolbar();
        }
      };

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleCloseWordToolbar();
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [activeWord, handleCloseWordToolbar]);

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
                          className="relative rounded-lg border border-black/5 dark:border-white/10 bg-base-100 shadow-sm overflow-auto"
                        >
                          {/* Speak/Stop page buttons overlay */}
                          <div className="absolute top-3 left-3 z-10 flex gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const text = pagesByNumber.get(pageNumber)?.text;
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
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStopSpeaking();
                              }}
                              className={`w-8 h-8 rounded-lg shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                                isSpeaking
                                  ? "bg-error/90 hover:bg-error text-error-content animate-pulse"
                                  : "bg-base-300/90 hover:bg-base-300 text-base-content opacity-50"
                              }`}
                              title="停止朗讀"
                            >
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
                                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 10h6v4H9z"
                                />
                              </svg>
                            </button>
                          </div>
                          <div className="p-2 sm:p-3">
                            <div className="relative">
                              <Page
                                pageNumber={pageNumber}
                                renderTextLayer={true}
                                renderAnnotationLayer
                                onGetTextSuccess={({ items }) => {
                                  // Extract page text
                                  const pageText = items
                                    .map((item) => {
                                      if (!("str" in item)) return "";
                                      return item.str + (item.hasEOL ? "\n" : " ");
                                    })
                                    .join("")
                                    .trim();

                                  console.log(`[PDF Page ${pageNumber}]`, pageText);

                                  if (onPageTextExtracted) {
                                    onPageTextExtracted(pageNumber, pageText);
                                  }
                                }}
                                onRenderTextLayerSuccess={() => {
                                  // Wait a frame for DOM to be ready, then extract positions
                                  requestAnimationFrame(() => {
                                    const pageEl = pageRefs.current[pageNumber - 1];
                                    if (pageEl) {
                                      extractWordPositionsFromDOM(pageNumber, pageEl);
                                    }
                                  });
                                }}
                                loading={
                                  <div className="skeleton w-full h-150 rounded-lg" />
                                }
                              />
                              {/* Word overlay for click detection */}
                              <WordOverlay
                                words={wordPositions.get(pageNumber) || []}
                                onWordClick={handleWordClick}
                              />
                            </div>
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

        {/* Word toolbar portal */}
        {activeWord &&
          createPortal(
            <WordToolbar
              word={activeWord.word}
              position={activeWord.position}
              onSpeak={() => onSpeak(activeWord.word)}
              onLookup={() => handleWordLookup(activeWord.word)}
              onClose={handleCloseWordToolbar}
              definition={wordDefinition}
              isLoading={isLoadingDefinition}
            />,
            document.body,
          )}
      </div>
    );
  },
);

PdfViewer.displayName = "PdfViewer";
