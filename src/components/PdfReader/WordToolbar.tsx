import { memo } from "react";

interface WordToolbarProps {
  word: string;
  position: { top: number; left: number };
  onSpeak: () => void;
  onLookup: () => void;
  onClose: () => void;
  definition?: string | null;
  isLoading?: boolean;
}

export const WordToolbar = memo(
  ({
    word,
    position,
    onSpeak,
    onLookup,
    onClose,
    definition,
    isLoading,
  }: WordToolbarProps) => {
    return (
      <div
        className="word-toolbar fixed z-50 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: "translateX(-50%)",
        }}
      >
        {/* Main toolbar - using SelectionToolbar style */}
        <div className="bg-accent text-accent-content rounded-full shadow-lg px-4 py-2 flex items-center gap-3 border border-accent/20">
          {/* Speak button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSpeak();
            }}
            className="btn btn-sm btn-circle bg-accent-content/20 hover:bg-accent-content/30 border-none text-accent-content"
            title="朗讀"
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
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
          </button>

          {/* Word display */}
          <span className="font-medium text-sm px-1">{word}</span>

          {/* Lookup button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLookup();
            }}
            className="btn btn-sm btn-circle bg-accent-content/20 hover:bg-accent-content/30 border-none text-accent-content"
            title="查詢解釋"
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
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="btn btn-sm btn-circle bg-accent-content/20 hover:bg-accent-content/30 border-none text-accent-content"
            title="關閉 (ESC)"
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

        {/* Definition result */}
        {(isLoading || definition) && (
          <div className="mt-2 w-full max-w-xs">
            <div className="bg-base-100 rounded-xl border border-black/5 dark:border-white/10 shadow-lg p-3 animate-in slide-in-from-top-2">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-base-content/60">
                  <span className="loading loading-spinner loading-xs"></span>
                  <span>查詢中...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-sm text-primary flex items-center gap-1">
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
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                      單字解釋
                    </h4>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-base-content/80">
                    {definition}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

WordToolbar.displayName = "WordToolbar";
