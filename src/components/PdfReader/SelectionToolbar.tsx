import type { SelectionToolbarPosition } from "../../hooks/useTextSelection";

interface SelectionToolbarProps {
  selectedText: string;
  translatedText: string;
  isTranslating: boolean;
  translateError: string | null;
  onSpeak: () => void;
  onTranslate: () => void;
  onClear: () => void;
  onClearTranslation: () => void;
  onAddToVocabulary?: () => void;
  isAddingToVocabulary?: boolean;
  position?: SelectionToolbarPosition | null;
}

export const SelectionToolbar = ({
  selectedText,
  translatedText,
  isTranslating,
  translateError,
  onSpeak,
  onTranslate,
  onClear,
  onClearTranslation,
  onAddToVocabulary,
  isAddingToVocabulary = false,
  position = null,
}: SelectionToolbarProps) => {
  if (!selectedText) return null;

  const isFloating = Boolean(position);
  const placement = position?.placement ?? "below";
  const containerClasses = isFloating
    ? `fixed z-50 transform -translate-x-1/2 ${
        placement === "above" ? "-translate-y-full" : "translate-y-0"
      }`
    : "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50";

  const containerStyle = isFloating
    ? { top: position!.top, left: position!.left }
    : undefined;

  const renderFeedback = () => {
    if (!translatedText && !translateError) return null;
    return (
      <div className="w-full max-w-md space-y-3 text-left">
        {translatedText && (
          <div className="bg-base-100 rounded-lg shadow-2xl p-4 animate-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-sm flex items-center gap-1">
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
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
                翻譯結果
              </h4>
              <button
                type="button"
                onClick={onClearTranslation}
                className="btn btn-ghost btn-xs btn-circle"
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed">{translatedText}</p>
          </div>
        )}

        {translateError && (
          <div className="bg-error/10 text-error rounded-lg shadow-2xl p-3 text-xs">
            <p>{translateError}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={containerClasses} style={containerStyle}>
      <div className="flex flex-col items-center gap-3">
        {placement === "above" && renderFeedback()}

        <div className="bg-accent text-accent-content rounded-full shadow-2xl px-6 py-3 flex items-center gap-3 backdrop-blur-md">
          <span className="text-sm font-medium hidden sm:inline">
            已選 {selectedText.length} 字
          </span>
          <div className="h-4 w-px bg-accent-content/30 hidden sm:block"></div>
          <div className="flex gap-2">
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
            <button
              type="button"
              onClick={onTranslate}
              disabled={isTranslating}
              className="btn btn-sm btn-circle bg-accent-content text-accent hover:bg-accent-content/90 border-0 tooltip tooltip-top"
              data-tip="翻譯"
            >
              {isTranslating ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
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
              )}
            </button>
            {onAddToVocabulary && (
              <button
                type="button"
                onClick={onAddToVocabulary}
                disabled={isAddingToVocabulary}
                className="btn btn-sm btn-circle bg-accent-content text-accent hover:bg-accent-content/90 border-0 tooltip tooltip-top"
                data-tip="加入生詞本"
              >
                {isAddingToVocabulary ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
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
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                )}
              </button>
            )}
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

        {placement !== "above" && renderFeedback()}
      </div>
    </div>
  );
};
