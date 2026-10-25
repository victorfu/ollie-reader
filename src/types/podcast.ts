/** Stable identifiers leave room for per-episode progress later. */
export interface PodcastEpisode {
  title: string;
  podcastTitle: string;
  artworkUrl: string | null;
  audioUrl: string;
  /** Signed backend path that relays audio with CORS for live captions; null when not configured. */
  captionAudioUrl?: string | null;
  durationSeconds: number | null;
  sourceUrl: string;
  podcastId: string;
  episodeId: string | null;
  guid: string;
}

export interface PodcastShow {
  kind: "show";
  podcastTitle: string;
  sourceUrl: string;
  episodes: PodcastEpisode[];
  unavailableCount: number;
}

export type PodcastResolution = PodcastEpisode | PodcastShow;

/** A recognised word placed on the episode's media timeline, in seconds. */
export interface PodcastCaptionWord {
  word: string;
  start: number;
  end: number;
}
