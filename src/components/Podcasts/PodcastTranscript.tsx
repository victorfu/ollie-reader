import { useContext } from "react";
import type { PodcastTranscript as Transcript } from "../../types/podcastTranscript";
import { formatPodcastTime } from "../../utils/podcastTime";
import { PodcastPlaybackContext } from "./PodcastPlaybackContext";

export function PodcastTranscript({ transcript }: { transcript: Transcript }) {
  const { time, seekable, seek } = useContext(PodcastPlaybackContext);
  const active = transcript.timingAvailable ? transcript.segments.findIndex((segment) => segment.start !== null && segment.end !== null && time >= segment.start && time < segment.end) : -1;
  return <section aria-label="英文字幕" className="space-y-3 border-t border-border-hairline pt-5">
    <h3 className="text-xl font-semibold">英文字幕</h3>
    <p className="text-sm text-muted-foreground">{transcript.timingAvailable ? "時間戳為 AI 估計值，可能有誤差。點選時間可跳轉播放。" : "此字幕沒有可靠時間戳，以完整文字顯示。"}</p>
    <div lang="en" className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border-hairline bg-background p-3 sm:p-4">
      {transcript.segments.map((segment, index) => transcript.timingAvailable && segment.start !== null ?
        <button key={segment.id} type="button" disabled={!seekable} onClick={() => seek(segment.start!)}
          aria-current={index === active ? "true" : undefined} aria-label={`跳至 ${formatPodcastTime(segment.start)}：${segment.text}`}
          className={`flex min-h-11 w-full select-text items-start gap-3 rounded-md p-2 text-left leading-relaxed hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent ${index === active ? "bg-accent/10" : ""}`}>
          <span className="shrink-0 py-1 text-sm tabular-nums text-accent">{formatPodcastTime(segment.start)}</span>
          <span className="min-w-0 whitespace-pre-wrap break-words">{segment.text}</span>
        </button> : <p key={segment.id} className="select-text whitespace-pre-wrap break-words p-2 leading-relaxed">{segment.text}</p>)}
    </div>
  </section>;
}
