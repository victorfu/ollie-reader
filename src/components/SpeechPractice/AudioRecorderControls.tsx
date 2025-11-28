import { useRef, useEffect } from "react";

interface AudioRecorderControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioUrl: string | null;
  isSupported: boolean;
  error: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onResetRecording: () => void;
}

export function AudioRecorderControls({
  isRecording,
  isPaused,
  recordingTime,
  audioUrl,
  isSupported,
  error,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onResetRecording,
}: AudioRecorderControlsProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Update audio source when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.load();
    }
  }, [audioUrl]);

  if (!isSupported) {
    return (
      <div className="alert alert-warning">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>您的瀏覽器不支援錄音功能</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        🎙️ 錄音功能
      </h3>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        {/* Recording Status */}
        {isRecording && (
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isPaused ? "bg-warning" : "bg-error animate-pulse"
              }`}
            />
            <span className="font-mono text-lg">{formatTime(recordingTime)}</span>
            <span className="text-sm text-base-content/60">
              {isPaused ? "(暫停)" : "錄音中..."}
            </span>
          </div>
        )}

        {/* Recording Controls */}
        <div className="flex gap-2">
          {!isRecording && !audioUrl && (
            <button
              type="button"
              className="btn btn-primary gap-2"
              onClick={onStartRecording}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V22h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              開始錄音
            </button>
          )}

          {isRecording && (
            <>
              {isPaused ? (
                <button
                  type="button"
                  className="btn btn-primary gap-2"
                  onClick={onResumeRecording}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  繼續錄音
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-warning gap-2"
                  onClick={onPauseRecording}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  暫停
                </button>
              )}

              <button
                type="button"
                className="btn btn-error gap-2"
                onClick={onStopRecording}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
                停止錄音
              </button>
            </>
          )}

          {audioUrl && !isRecording && (
            <button
              type="button"
              className="btn btn-outline gap-2"
              onClick={onResetRecording}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
              </svg>
              重新錄音
            </button>
          )}
        </div>

        {/* Audio Playback */}
        {audioUrl && !isRecording && (
          <div className="w-full max-w-md">
            <audio ref={audioRef} controls className="w-full" preload="metadata">
              <source src={audioUrl} type="audio/webm" />
              您的瀏覽器不支援音訊播放
            </audio>
          </div>
        )}
      </div>
    </div>
  );
}
