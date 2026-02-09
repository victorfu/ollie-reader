import { useState, useCallback, useRef, useEffect } from "react";
import {
  getSeasons,
  getEpisodesBySeason,
  fetchEpisodeTranscript,
} from "../services/showSubtitlesService";
import { isAbortError } from "../utils/errorUtils";
import { logger } from "../utils/logger";
import type { Season, Episode, Transcript } from "../types/showSubtitles";

export const useShowSubtitles = () => {
  const [seasons] = useState<Season[]>(getSeasons);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const currentSeasonEpisodes = getEpisodesBySeason(selectedSeason)?.episodes ?? [];

  const selectSeason = useCallback((seasonNumber: number) => {
    setSelectedSeason(seasonNumber);
    setSelectedEpisode(null);
    setTranscript(null);
    setError(null);
  }, []);

  const selectEpisode = useCallback(
    async (episode: Episode) => {
      // Abort any in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setSelectedEpisode(episode);
      setTranscript(null);
      setLoading(true);
      setError(null);

      try {
        const result = await fetchEpisodeTranscript(
          selectedSeason,
          episode.slug,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setTranscript(result);
        }
      } catch (err) {
        if (isAbortError(err)) return;
        const message =
          err instanceof Error ? err.message : "Failed to load transcript";
        logger.error("Failed to fetch transcript:", err);
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [selectedSeason],
  );

  const clearTranscript = useCallback(() => {
    abortControllerRef.current?.abort();
    setSelectedEpisode(null);
    setTranscript(null);
    setError(null);
  }, []);

  return {
    seasons,
    selectedSeason,
    currentSeasonEpisodes,
    selectedEpisode,
    transcript,
    loading,
    error,
    selectSeason,
    selectEpisode,
    clearTranscript,
  };
};
