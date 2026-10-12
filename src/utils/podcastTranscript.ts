// Dependency-free contract shared with the web client. Bump for incompatible changes.
export const TRANSCRIPT_MODEL = "gemini-3.5-flash-lite";
export const TRANSCRIPT_SCHEMA_VERSION = 1;
export interface TranscriptSegment {
  id: string;
  start: number | null;
  end: number | null;
  text: string;
}
export interface PodcastTranscript {
  id: string;
  podcastId: string;
  episodeId: string | null;
  guid: string;
  episodeTitle: string;
  model: string;
  language: "en";
  status: "completed";
  fullText: string;
  segments: TranscriptSegment[];
  timingAvailable: boolean;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
export type TranscriptResult =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "failed"; error: string }
  | { status: "completed"; transcript: PodcastTranscript };

/** Bad timing degrades the ENTIRE result to text. Never interpolate alignment.
 * A two-second overrun tolerates rounding at the end of the actual audio. */
export function parseTranscript(raw: string, duration: number) {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("segments" in value) || !Array.isArray(value.segments) || !value.segments.length) {
    throw new Error("字幕內容為空或格式不正確，請重試。");
  }
  let previousEnd = 0;
  let timingAvailable = Number.isFinite(duration) && duration > 0;
  const segments: TranscriptSegment[] = value.segments.map((item: unknown, index: number) => {
    if (!item || typeof item !== "object" || !("text" in item) || typeof item.text !== "string" || !item.text.trim()) {
      throw new Error("字幕段落缺少文字，請重試。");
    }
    const start = "start" in item ? item.start : null;
    const end = "end" in item ? item.end : null;
    const valid = typeof start === "number" && Number.isFinite(start) && start >= 0 &&
      typeof end === "number" && Number.isFinite(end) && end > start && start >= previousEnd && end <= duration + 2;
    if (!valid) timingAvailable = false;
    else previousEnd = end;
    return { id: `segment-${index + 1}`, text: item.text.trim(), start: valid ? start : null, end: valid ? end : null };
  });
  if (!timingAvailable) segments.forEach((segment) => { segment.start = null; segment.end = null; });
  return { segments, timingAvailable, fullText: segments.map((segment) => segment.text).join("\n\n") };
}
