import { memo } from "react";
import type { SelectionToolbarPosition } from "../../hooks/useTextSelection";

interface SelectionToolbarProps {
  selectedText: string;
  onSpeak: () => void;
  onTranslate: () => void;
  onClear: () => void;
  onAddToVocabulary?: () => void;
  position?: SelectionToolbarPosition | null;
}

// Check if selected text is a single word (for vocabulary lookup)
const isSingleWord = (text: string): boolean => {
  const trimmed = text.trim();
  return trimmed.length > 0 && !trimmed.includes(" ");
};

export const SelectionToolbar = memo(
  ({
    selectedText,
    onSpeak,
    onTranslate,
    onClear,
    onAddToVocabulary,
    position = null,
  }: SelectionToolbarProps) => {
  if (!selectedText) return null;

  const isFloating = Boolean(position);
  const translateY = position?.placement === "above" ? "-translate-y-full" : "translate-y-0";
  const containerClasses = isFloating
    ? `fixed z-50 transform -translate-x-1/2 ${translateY}`
    : "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50";
  const containerStyle = isFloating
    ? { top: position!.top, left: position!.left }
    : undefined;

  return (
    <div className={containerClasses} style={containerStyle}>
      <div className="bg-accent text-accent-content rounded-full shadow-floating px-6 py-3 flex items-center gap-3 border border-accent/20">
        <div className="flex gap-2">
          {/* Speak button */}
          <button
            type="button"
            onClick={onSpeak}
            className="btn btn-sm btn-circle bg-accent-content text-accent hover:bg-accent-content/90 border-0 tooltip tooltip-top"
            data-tip="朗讀"
          >
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
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
          </button>

          {/* Single word: Vocabulary lookup button (查詢/加入生詞本) */}
          {isSingleWord(selectedText) && onAddToVocabulary && (
            <button
              type="button"
              onClick={onAddToVocabulary}
              className="btn btn-sm btn-circle bg-accent-content text-accent hover:bg-accent-content/90 border-0 tooltip tooltip-top"
              data-tip="查詢單字"
            >
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
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </button>
          )}

          {/* Multiple words / sentence: Translate button */}
          {!isSingleWord(selectedText) && (
            <button
              type="button"
              onClick={onTranslate}
              className="btn btn-sm btn-circle bg-accent-content text-accent hover:bg-accent-content/90 border-0 tooltip tooltip-top"
              data-tip="翻譯"
            >
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
                  strokeWidth={2}
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
            </button>
          )}

          {/* Clear button */}
          <button
            type="button"
            onClick={onClear}
            className="btn btn-sm btn-circle bg-accent-content/20 text-accent-content hover:bg-accent-content/30 border-0 tooltip tooltip-top"
            data-tip="清除 (ESC)"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
  }
);

SelectionToolbar.displayName = "SelectionToolbar";
