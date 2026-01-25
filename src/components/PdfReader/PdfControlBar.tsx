import { memo } from "react";
import type { TTSMode, ReadingMode, ExtractResponse } from "../../types/pdf";

interface PdfControlBarProps {
  // TTS Controls
  ttsMode: TTSMode;
  readingMode: ReadingMode;
  speechRate: number;
  isSpeaking: boolean;
  isLoadingAudio: boolean;
  onTtsModeChange: (mode: TTSMode) => void;
  onReadingModeChange: (mode: ReadingMode) => void;
  onStop: () => void;

  // File Info
  result: ExtractResponse;
  onClearCache?: () => void;
  isClearingCache?: boolean;
}

export const PdfControlBar = memo(
  ({
    ttsMode,
    readingMode,
    speechRate,
    isSpeaking,
    isLoadingAudio,
    onTtsModeChange,
    onReadingModeChange,
    onStop,
    result,
    onClearCache,
    isClearingCache,
  }: PdfControlBarProps) => {
    return (
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-base-100/80 backdrop-blur-xl shadow-sm mb-2">
        <div className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: TTS Controls */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-4 items-center">
              {/* TTS Mode Selection */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onTtsModeChange("browser")}
                  className={`flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                    ttsMode === "browser"
                      ? "bg-info text-info-content shadow-sm"
                      : "bg-base-100 border border-black/10 dark:border-white/10 text-info hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  title="使用系統內建語音引擎"
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
                      strokeWidth={1.5}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="hidden sm:inline">系統語音</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTtsModeChange("api")}
                  className={`flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                    ttsMode === "api"
                      ? "bg-success text-success-content shadow-sm"
                      : "bg-base-100 border border-black/10 dark:border-white/10 text-success hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  title="使用雲端 AI 語音合成"
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
                      strokeWidth={1.5}
                      d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                  </svg>
                  <span className="hidden sm:inline">AI 語音</span>
                </button>
              </div>

              <div className="hidden sm:block w-px h-6 bg-black/10 dark:bg-white/10"></div>

              {/* Reading Mode Toggle */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onReadingModeChange("word")}
                  className={`flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                    readingMode === "word"
                      ? "bg-primary text-primary-content shadow-sm"
                      : "bg-base-100 border border-black/10 dark:border-white/10 text-primary hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  title="點擊單字朗讀"
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
                      strokeWidth={1.5}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  <span className="hidden sm:inline">單字</span>
                </button>
                <button
                  type="button"
                  onClick={() => onReadingModeChange("selection")}
                  className={`flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                    readingMode === "selection"
                      ? "bg-accent text-accent-content shadow-sm"
                      : "bg-base-100 border border-black/10 dark:border-white/10 text-accent hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  title="選取文字朗讀"
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
                      strokeWidth={1.5}
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                    />
                  </svg>
                  <span className="hidden sm:inline">選取</span>
                </button>
              </div>

              <div className="hidden sm:block w-px h-6 bg-black/10 dark:bg-white/10"></div>

              {/* Speech Rate Display */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-base-content/60 whitespace-nowrap">
                  語速
                </span>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                  {speechRate.toFixed(1)}x
                </span>
              </div>

              {/* Stop Button */}
              {(isSpeaking || isLoadingAudio) && (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium border border-error/30 text-error bg-error/10 hover:bg-error/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                  disabled={isLoadingAudio}
                >
                  {isLoadingAudio ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      <span className="hidden sm:inline">生成中</span>
                    </>
                  ) : (
                    <>
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
                          strokeWidth={1.5}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                        />
                      </svg>
                      <span className="hidden sm:inline">停止</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Right: File Info */}
            <div className="flex items-center gap-3 border-t sm:border-t-0 border-black/5 dark:border-white/10 pt-3 sm:pt-0">
              {/* Filename */}
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 stroke-current text-primary flex-shrink-0"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span
                  className="text-sm font-medium text-primary truncate max-w-24 sm:max-w-40"
                  title={result.filename}
                >
                  {result.filename}
                </span>
              </div>

              <div className="hidden sm:block w-px h-6 bg-black/10 dark:bg-white/10"></div>

              {/* Page Count */}
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 stroke-current text-secondary flex-shrink-0"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                <span className="px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-xs font-medium whitespace-nowrap">
                  {result.total_pages} 頁
                </span>
              </div>

              {/* Clear Cache Button */}
              {onClearCache && (
                <>
                  <div className="hidden sm:block w-px h-6 bg-black/10 dark:bg-white/10"></div>
                  <button
                    onClick={onClearCache}
                    disabled={isClearingCache}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium border border-error/30 text-error bg-error/10 hover:bg-error/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                    title="清除快取後需重新載入 PDF"
                  >
                    {isClearingCache ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        <span className="hidden sm:inline">清除中</span>
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          className="w-4 h-4 stroke-current"
                          strokeWidth="1.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        <span className="hidden sm:inline">清除快取</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

PdfControlBar.displayName = "PdfControlBar";
