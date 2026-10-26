import { T } from "../common/T";

interface TimerDisplayProps {
  time: number;
  suggestedTime: number;
  isRunning: boolean;
  isPaused: boolean;
}

export function TimerDisplay({
  time,
  suggestedTime,
  isRunning,
  isPaused,
}: TimerDisplayProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const progress = Math.min((time / suggestedTime) * 100, 100);
  const isOverTime = time > suggestedTime;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`radial-progress text-4xl ${
          isOverTime
            ? "text-error"
            : isRunning
            ? isPaused
              ? "text-warning"
              : "text-primary"
            : "text-base-content/30"
        }`}
        style={
          {
            "--value": progress,
            "--size": "8rem",
            "--thickness": "6px",
          } as React.CSSProperties
        }
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="flex flex-col items-center">
          <span
            className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${
              isOverTime ? "text-error" : ""
            }`}
          >
            {formatTime(time)}
          </span>
          {isRunning && isPaused && (
            <span className="text-xs text-warning">
              <T k="listening.speech.paused" />
            </span>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <T
          k="listening.speech.suggestedTime"
          params={{ time: formatTime(suggestedTime) }}
        />
      </div>

      {isOverTime && (
        <div className="text-sm text-error">
          <T
            k="listening.speech.overTime"
            params={{ time: formatTime(time - suggestedTime) }}
          />
        </div>
      )}
    </div>
  );
}
