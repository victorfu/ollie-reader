import { logger } from "../utils/logger";
import type { Season, Transcript, SubtitleLine } from "../types/showSubtitles";
import { SEASONS } from "../data/showSeasons";
export { SEASONS } from "../data/showSeasons";

/**
 * Get all seasons with their episodes
 */
export const getSeasons = (): Season[] => {
  return SEASONS;
};

/**
 * Get episodes for a specific season
 */
export const getEpisodesBySeason = (seasonNumber: number): Season | undefined => {
  return SEASONS.find((s) => s.number === seasonNumber);
};

/**
 * Fetch the transcript for a specific episode from static JSON files.
 */
export const fetchEpisodeTranscript = async (
  seasonNumber: number,
  episodeSlug: string,
  signal?: AbortSignal,
): Promise<Transcript> => {
  const episode = SEASONS
    .find((s) => s.number === seasonNumber)
    ?.episodes.find((e) => e.slug === episodeSlug);

  if (!episode) {
    throw new Error(`Episode not found: season ${seasonNumber}, ${episodeSlug}`);
  }

  if (episode.transcriptAvailable === false) {
    throw new Error("此集字幕尚未提供");
  }

  const url = `/transcripts/season-${seasonNumber}/${episodeSlug}.json`;

  logger.debug("Loading transcript:", url);

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load transcript: ${response.status} ${response.statusText}`);
  }

  const lines: SubtitleLine[] = await response.json();

  logger.debug(`Loaded ${lines.length} transcript lines for S${seasonNumber}E${episode.number}`);

  return {
    seasonNumber,
    episodeNumber: episode.number,
    title: episode.title,
    lines,
  };
};
