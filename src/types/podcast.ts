/** Stable identifiers leave room for per-episode progress later. */
export interface PodcastEpisode {
  title: string;
  podcastTitle: string;
  artworkUrl: string | null;
  audioUrl: string;
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
