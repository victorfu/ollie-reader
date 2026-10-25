import { Fragment } from "react";
import type { PodcastCaptionWord } from "../../types/podcast";
import { formatPodcastTime } from "../../utils/podcastTime";

/** The episode's recognised English so far; it stays after playback ends. */
export function PodcastTranscript({ words, time, onSeek }: { words: PodcastCaptionWord[]; time: number; onSeek: (time: number) => void }) {
  if (!words.length) return null;
  return (
    <details className="rounded-lg border border-border-hairline">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-medium">
        完整逐字稿
        <span className="text-xs font-normal text-muted-foreground">{words.length} 字 · 到 {formatPodcastTime(words[words.length - 1].end)}</span>
      </summary>
      <p lang="en" className="max-h-72 overflow-y-auto break-words border-t border-border-hairline p-3 leading-relaxed">
        {words.map((word, index) => (
          <Fragment key={`${word.start}-${index}`}><button type="button" title={`跳到 ${formatPodcastTime(word.start)}`} onClick={() => onSeek(word.start)}
            className={`rounded hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${word.start <= time && time < word.end ? "bg-accent/15 text-accent" : ""}`}>
            {word.word}
          </button>{" "}</Fragment>
        ))}
      </p>
    </details>
  );
}
