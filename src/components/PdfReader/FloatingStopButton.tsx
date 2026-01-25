import { memo } from "react";

interface FloatingStopButtonProps {
  isSpeaking: boolean;
  isLoadingAudio: boolean;
  onStop: () => void;
}

export const FloatingStopButton = memo(
  ({ isSpeaking, isLoadingAudio, onStop }: FloatingStopButtonProps) => {
    // Only show when speaking or loading
    if (!isSpeaking && !isLoadingAudio) return null;

    return (
      <button
        type="button"
        onClick={onStop}
        disabled={isLoadingAudio}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-40
          flex items-center justify-center
          bg-error/90 hover:bg-error text-error-content
          backdrop-blur-xl border border-error/20
          hover:scale-105 active:scale-[0.98]
          transition-all duration-200
          disabled:opacity-70 disabled:cursor-not-allowed
          ${isSpeaking && !isLoadingAudio ? "animate-pulse" : ""}`}
        aria-label={isLoadingAudio ? "音訊生成中" : "停止朗讀"}
        title={isLoadingAudio ? "音訊生成中..." : "停止朗讀"}
      >
        {isLoadingAudio ? (
          <span className="loading loading-spinner loading-md"></span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
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
        )}
      </button>
    );
  }
);

FloatingStopButton.displayName = "FloatingStopButton";
