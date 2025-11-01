import type { TTSMode } from "../../types/pdf";

interface SimpleTTSControlsProps {
  ttsMode: TTSMode;
  speechRate: number;
  isSpeaking: boolean;
  isLoadingAudio: boolean;
  onTtsModeChange: (mode: TTSMode) => void;
  onSpeechRateChange: (rate: number) => void;
  onStop: () => void;
}

export const SimpleTTSControls = ({
  ttsMode,
  speechRate,
  isSpeaking,
  isLoadingAudio,
  onTtsModeChange,
  onSpeechRateChange,
  onStop,
}: SimpleTTSControlsProps) => {
  return (
    <div className="card bg-base-100 shadow-md">
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
              系統語音
            </button>
            <button
              type="button"
              onClick={() => onTtsModeChange("api")}
              className={`btn btn-sm ${
                ttsMode === "api" ? "btn-success" : "btn-outline btn-success"
              }`}
              title="使用 AI 語音合成"
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
              AI 語音
            </button>
          </div>

          {/* Speech Rate Control */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-base-content/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(e) => onSpeechRateChange(Number(e.target.value))}
              className="range range-xs flex-1"
              title="調整語音速度"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-base-content/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-sm font-mono min-w-[3rem] text-center">
              {speechRate.toFixed(1)}x
            </span>
          </div>

          {/* Stop Button */}
          {(isSpeaking || isLoadingAudio) && (
            <button
              type="button"
              onClick={onStop}
              className="btn btn-sm btn-error"
              disabled={isLoadingAudio}
            >
              {isLoadingAudio ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  載入中...
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
                      d="M9 10h6v4H9z"
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
};
