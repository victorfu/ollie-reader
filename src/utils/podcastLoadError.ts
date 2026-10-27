import type { MessageKey } from "../i18n/translate";

/** A message of ours (translated on render) or text from the server. */
export type PodcastLoadError = { key: MessageKey } | { text: string };

export function podcastLoadError(cause: unknown): PodcastLoadError {
  if (cause instanceof Error && cause.name === "TimeoutError") return { key: "listening.podcast.error.timeout" };
  if (cause instanceof TypeError) return { key: "listening.podcast.error.network" };
  if (cause instanceof Error) return { text: cause.message };
  return { key: "listening.podcast.error.generic" };
}
