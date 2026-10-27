import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { resolvePodcast } from "../../services/podcastService";
import { getSavedPodcast } from "../../services/podcastLibraryService";
import type { PodcastEpisode, PodcastShow, SavedPodcast } from "../../types/podcast";
import { PodcastPlayer } from "./PodcastPlayer";
import { formatPodcastTime } from "../../utils/podcastTime";
import { podcastLoadError, type PodcastLoadError } from "../../utils/podcastLoadError";
import { T } from "../common/T";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../hooks/useLanguage";

/** Plays one saved podcast: an episode directly, or a show's chosen episode. */
export default function PodcastDetail() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { podcastId = "" } = useParams();
  const [saved, setSaved] = useState<SavedPodcast | null>(null);
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [show, setShow] = useState<PodcastShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<PodcastLoadError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true); setError(null); setNotFound(false); setEpisode(null); setShow(null);
    void (async () => {
      try {
        const item = await getSavedPodcast(uid, podcastId);
        if (signal.aborted) return;
        setSaved(item);
        if (!item) { setNotFound(true); return; }
        const result = await resolvePodcast(item.url, signal);
        if (signal.aborted) return;
        if ("episodes" in result) setShow(result);
        else setEpisode(result);
      } catch (cause) {
        if (!signal.aborted) setError(podcastLoadError(cause));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [uid, podcastId, attempt]);

  return (
    // Sized by its own width, not the viewport: on iPad the sidebar comes and
    // goes between portrait and landscape.
    <div className="@container mx-auto w-full max-w-5xl space-y-6">
      <Link to="/podcasts" className="btn btn-ghost btn-sm -ml-2 min-h-11 gap-1"><ChevronLeft size={18} /><T k="listening.podcast.backToList" /></Link>
      {saved && !show && !episode && <h1 className="break-words text-2xl font-semibold tracking-tight">{saved.title}</h1>}
      {loading && <p role="status"><T k="listening.podcast.loadingData" /></p>}
      {notFound && <p role="alert" className="rounded-lg border border-border-hairline bg-background p-4 text-destructive"><T k="listening.podcast.notFound" /></p>}
      {error && <div role="alert" className="space-y-3 rounded-lg border border-border-hairline bg-background p-4">
        <p className="text-destructive">{"key" in error ? <T k={error.key} /> : error.text}</p>
        <button type="button" className="btn btn-outline btn-sm min-h-11" onClick={() => setAttempt((value) => value + 1)}><T k="listening.podcast.retry" /></button>
      </div>}
      {show && <section aria-label={t("listening.podcast.episodesLabel")} className="min-w-0 space-y-3 rounded-xl border border-border-hairline bg-background p-4 shadow-sm">
        <h1 className="break-words text-xl font-semibold">{show.podcastTitle}</h1>
        <p className="text-sm text-muted-foreground"><T k="listening.podcast.episodeCount" params={{ count: show.episodes.length }} /></p>
        <label htmlFor="podcast-episode" className="block text-sm font-medium"><T k="listening.podcast.chooseEpisode" /></label>
        <select id="podcast-episode" className="select select-bordered min-h-11 w-full min-w-0" value={episode?.guid ?? ""}
          onChange={(event) => setEpisode(show.episodes.find((item) => item.guid === event.target.value) ?? null)}>
          <option value="" disabled>{t("listening.podcast.chooseEpisodePlaceholder")}</option>
          {show.episodes.map((item) => <option key={item.guid} value={item.guid}>{item.title}{item.durationSeconds === null ? "" : t("listening.podcast.optionDuration", { time: formatPodcastTime(item.durationSeconds) })}</option>)}
        </select>
        {show.unavailableCount > 0 && <p className="text-xs text-muted-foreground"><T k="listening.podcast.unavailable" params={{ count: show.unavailableCount }} /></p>}
      </section>}
      {episode && <article className="space-y-6 rounded-xl border border-border-hairline bg-background p-4 shadow-sm @md:p-6">
        <div className="flex flex-col items-start gap-4 @md:flex-row">
          {episode.artworkUrl && <img src={episode.artworkUrl} alt="" referrerPolicy="no-referrer" className="size-28 shrink-0 rounded-lg object-cover @4xl:size-32" onError={(event) => { event.currentTarget.hidden = true; }} />}
          <div className="min-w-0 space-y-2"><p className="break-words text-sm text-muted-foreground">{episode.podcastTitle}</p><h2 className="break-words text-xl font-semibold">{episode.title}</h2>{episode.durationSeconds !== null && <p className="text-sm text-muted-foreground"><T k="listening.podcast.episodeLength" params={{ time: formatPodcastTime(episode.durationSeconds) }} /></p>}</div>
        </div>
        <PodcastPlayer key={`${episode.podcastId}:${episode.guid}`} episode={episode} />
      </article>}
    </div>
  );
}
