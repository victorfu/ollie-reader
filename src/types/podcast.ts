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

/**
 * The audible path's delay line: `seconds` of wall-clock delay, filled at
 * playback `rate`, last emptied at media time `anchor`.
 */
export interface CaptionDelay {
  seconds: number;
  rate: number;
  anchor: number;
}

/** A recognised word placed on the episode's media timeline, in seconds. */
export interface PodcastCaptionWord {
  word: string;
  start: number;
  end: number;
}

/** A podcast link the user saved to their library, stored at `users/{uid}/podcasts/{id}`. */
export interface SavedPodcast {
  id: string;
  kind: "show" | "episode";
  /** The resolver's canonical link; reopening the item resolves it again. */
  url: string;
  /** The episode title, or the show title for a show. */
  title: string;
  podcastTitle: string;
  artworkUrl: string | null;
  /** Milliseconds since the epoch. */
  addedAt: number;
}
