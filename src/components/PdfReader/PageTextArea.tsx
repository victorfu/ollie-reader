import { memo, useCallback } from "react";
import type { ReactNode } from "react";
import type { ReadingMode } from "../../types/pdf";

// Regex defined outside component to avoid recreation on each render
const WORD_REGEX = /[A-Za-z]+(?:[''-][A-Za-z]+)*/g;

interface PageTextAreaProps {
  pageNumber: number;
  text: string;
  readingMode: ReadingMode;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  onTextSelection: () => void;
  isLoadingAudio?: boolean;
}

export const PageTextArea = memo(
  ({
    pageNumber,
    text,
    readingMode,
    onSpeak,
    onStopSpeaking,
    onTextSelection,
    isLoadingAudio,
  }: PageTextAreaProps) => {
    const renderTextWithClickableWords = useCallback(
      (text: string) => {
        const nodes: ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let key = 0;

        // Reset regex lastIndex since it's stateful
        WORD_REGEX.lastIndex = 0;
        while ((match = WORD_REGEX.exec(text)) !== null) {
          const [word] = match;
          const start = match.index;
          const end = start + word.length;
          if (start > lastIndex) {
            nodes.push(text.slice(lastIndex, start));
          }
          nodes.push(
            <button
              key={`w-${key++}-${start}`}
              type="button"
              onClick={() => onSpeak(word)}
              className="inline rounded hover:bg-warning/30 hover:text-warning-content transition-colors focus:outline-none focus:ring-2 focus:ring-warning/50"
              title={`Speak: ${word}`}
            >
              {word}
            </button>,
          );
          lastIndex = end;
        }
        if (lastIndex < text.length) {
          nodes.push(text.slice(lastIndex));
        }

        return (
          <div className="whitespace-pre-wrap leading-relaxed text-left text-xl sm:text-2xl">
            {nodes}
          </div>
        );
      },
      [onSpeak],
    );

    const renderSelectableText = useCallback(
      (text: string) => {
        return (
          <div
            className="whitespace-pre-wrap leading-relaxed text-left select-text cursor-text text-xl sm:text-2xl"
            onMouseUp={onTextSelection}
            onTouchEnd={onTextSelection}
          >
            {text}
          </div>
        );
      },
      [onTextSelection],
    );

    return (
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-base-100 shadow-sm">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-xl sm:text-2xl font-semibold">
              <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-base font-medium">
                Page {pageNumber}
              </span>
            </h3>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onSpeak(text)}
                className="flex items-center gap-2 h-9 sm:h-10 px-4 rounded-lg text-sm font-medium bg-success text-success-content shadow-sm hover:bg-success/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                disabled={isLoadingAudio}
              >
                {isLoadingAudio ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    生成中
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    朗讀此頁
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onStopSpeaking}
                className="flex items-center h-9 sm:h-10 px-4 rounded-lg text-sm font-medium bg-base-100 border border-black/10 dark:border-white/10 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-200"
              >
                停止
              </button>
            </div>
          </div>
          <div className="h-px bg-black/5 dark:bg-white/10 my-4"></div>
          <div
            className="prose prose-lg sm:prose-xl lg:prose-2xl max-w-none overflow-auto"
            style={{ maxHeight: "750px" }}
          >
            {readingMode === "word" && renderTextWithClickableWords(text || "")}
            {readingMode === "selection" && renderSelectableText(text || "")}
          </div>
        </div>
      </div>
    );
  },
);

PageTextArea.displayName = "PageTextArea";
