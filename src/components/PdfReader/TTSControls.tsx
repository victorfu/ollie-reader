import { memo } from "react";
import type { TTSMode, ReadingMode } from "../../types/pdf";

interface TTSControlsProps {
  ttsMode: TTSMode;
  readingMode: ReadingMode;
  speechRate: number;
  isSpeaking: boolean;
  isLoadingAudio: boolean;
  onTtsModeChange: (mode: TTSMode) => void;
  onReadingModeChange: (mode: ReadingMode) => void;
  onStop: () => void;
}

export const TTSControls = memo(
  ({
    ttsMode,
    readingMode,
    speechRate,
    isSpeaking,
    isLoadingAudio,
    onTtsModeChange,
    onReadingModeChange,
    onStop,
  }: TTSControlsProps) => {
    return (
    <div className="card bg-base-100 shadow-md mb-6">
      <div className="card-body p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* TTS Mode Selection */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onTtsModeChange("browser")}
              className={`btn btn-sm ${
                ttsMode === "browser" ? "btn-info" : "btn-outline btn-info"
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
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className="hidden sm:inline ml-1">系統語音</span>
            </button>
            <button
              type="button"
              onClick={() => onTtsModeChange("api")}
              className={`btn btn-sm ${
                ttsMode === "api" ? "btn-success" : "btn-outline btn-success"
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
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
              <span className="hidden sm:inline ml-1">AI 語音</span>
            </button>
          </div>

          <div className="divider divider-horizontal hidden sm:flex m-0"></div>

          {/* Reading Mode Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onReadingModeChange("word")}
              className={`btn btn-sm ${
                readingMode === "word"
                  ? "btn-primary"
                  : "btn-outline btn-primary"
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
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              <span className="hidden sm:inline ml-1">單字</span>
            </button>
            <button
              type="button"
              onClick={() => onReadingModeChange("selection")}
              className={`btn btn-sm ${
                readingMode === "selection"
                  ? "btn-accent"
                  : "btn-outline btn-accent"
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
                  strokeWidth={2}
                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                />
              </svg>
              <span className="hidden sm:inline ml-1">選取</span>
            </button>
          </div>

          {/* Speech Rate Display */}
          <div className="flex items-center gap-2">
            <span className="text-sm whitespace-nowrap">語速</span>
            <span className="badge badge-primary badge-sm">
              {speechRate.toFixed(1)}x
            </span>
          </div>

          {/* Stop Button */}
          {(isSpeaking || isLoadingAudio) && (
            <button
              type="button"
              onClick={onStop}
              className="btn btn-error btn-sm gap-1"
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
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                    />
                  </svg>
                  停止
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
    );
  }
);

TTSControls.displayName = "TTSControls";
