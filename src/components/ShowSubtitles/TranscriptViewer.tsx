import type { Episode, Transcript } from "../../types/showSubtitles";

interface TranscriptViewerProps {
  episode: Episode;
  transcript: Transcript | null;
  loading: boolean;
  error: string | null;
}

export function TranscriptViewer({
  episode,
  transcript,
  loading,
  error,
}: TranscriptViewerProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary mb-4" />
        <p className="text-base-content/60 text-sm">載入字幕中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 inline-flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-error shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm text-error">{error}</span>
        </div>
      </div>
    );
  }

  if (!transcript || transcript.lines.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-base-content/60">沒有字幕資料</p>
      </div>
    );
  }

  return (
    <div>
      {/* Episode header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-black/5 dark:border-white/10">
        <div className="w-9 h-9 rounded-lg bg-primary text-primary-content flex items-center justify-center text-sm font-bold shrink-0">
          {episode.number}
        </div>
        <h3 className="text-lg font-semibold">{episode.title}</h3>
      </div>

      {/* Subtitle lines */}
      <div className="max-h-[70vh] overflow-y-auto pr-2 -mr-2">
        {transcript.lines.map((line) => (
          <div
            key={line.index}
            className="flex gap-4 items-baseline py-2.5 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0 hover:bg-base-200/30 rounded-md px-3 -mx-3 transition-colors"
          >
            <span className="text-xs text-base-content/25 font-mono shrink-0 w-8 text-right tabular-nums select-none">
              {line.index + 1}
            </span>
            <p className="text-base leading-7 text-base-content/85 flex-1">
              {line.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
