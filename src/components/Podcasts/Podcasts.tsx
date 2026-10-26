import { useEffect, useRef, useState, type FormEvent } from "react";
import { Headphones } from "lucide-react";
import { resolvePodcast } from "../../services/podcastService";
import type { PodcastEpisode, PodcastShow } from "../../types/podcast";
import { PodcastPlayer } from "./PodcastPlayer";
import { formatPodcastTime } from "../../utils/podcastTime";
import { T } from "../common/T";
import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey } from "../../i18n/translate";

/** A message of ours (translated on render) or text from the server. */
type LoadError = { key: MessageKey } | { text: string };

export default function Podcasts() {
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [show, setShow] = useState<PodcastShow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadError | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const load = async (event: FormEvent) => {
    event.preventDefault();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(null); setEpisode(null); setShow(null);
    try {
      const result = await resolvePodcast(url.trim(), controller.signal);
      if (!controller.signal.aborted) {
        if ("episodes" in result) setShow(result);
        else setEpisode(result);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && cause.name === "TimeoutError" ? { key: "listening.podcast.error.timeout" } : cause instanceof TypeError ? { key: "listening.podcast.error.network" } : cause instanceof Error ? { text: cause.message } : { key: "listening.podcast.error.generic" });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <header className="space-y-2"><h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight"><Headphones className="shrink-0" /><T k="listening.podcast.title" /></h1><p className="text-muted-foreground"><T k="listening.podcast.subtitle" /></p></header>
      <form onSubmit={(event) => void load(event)} className="space-y-2">
        <label htmlFor="podcast-url" className="text-sm font-medium"><T k="listening.podcast.urlLabel" /></label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="podcast-url" type="url" required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://podcasts.apple.com/…?i=…" className="input input-bordered min-h-11 w-full min-w-0 flex-1" />
          <button type="submit" disabled={loading || !url.trim()} className="btn btn-primary min-h-11 shrink-0">{loading ? <T k="listening.podcast.loadingButton" /> : <T k="listening.podcast.load" />}</button>
        </div>
        <p className="text-xs text-muted-foreground"><T k="listening.podcast.urlHint" /></p>
      </form>
      {loading && <p role="status"><T k="listening.podcast.loadingData" /></p>}
      {error && <p role="alert" className="rounded-lg border border-border-hairline bg-background p-4 text-destructive">{"key" in error ? <T k={error.key} /> : error.text}</p>}
      {show && <section aria-label={t("listening.podcast.episodesLabel")} className="min-w-0 space-y-3 rounded-xl border border-border-hairline bg-background p-4 shadow-sm">
        <h2 className="break-words text-xl font-semibold">{show.podcastTitle}</h2>
        <p className="text-sm text-muted-foreground"><T k="listening.podcast.episodeCount" params={{ count: show.episodes.length }} /></p>
        <label htmlFor="podcast-episode" className="block text-sm font-medium"><T k="listening.podcast.chooseEpisode" /></label>
        <select id="podcast-episode" className="select select-bordered min-h-11 w-full min-w-0" value={episode?.guid ?? ""}
          onChange={(event) => setEpisode(show.episodes.find((item) => item.guid === event.target.value) ?? null)}>
          <option value="" disabled>{t("listening.podcast.chooseEpisodePlaceholder")}</option>
          {show.episodes.map((item) => <option key={item.guid} value={item.guid}>{item.title}{item.durationSeconds === null ? "" : t("listening.podcast.optionDuration", { time: formatPodcastTime(item.durationSeconds) })}</option>)}
        </select>
        {show.unavailableCount > 0 && <p className="text-xs text-muted-foreground"><T k="listening.podcast.unavailable" params={{ count: show.unavailableCount }} /></p>}
      </section>}
      {episode && <article className="space-y-6 rounded-xl border border-border-hairline bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          {episode.artworkUrl && <img src={episode.artworkUrl} alt="" referrerPolicy="no-referrer" className="size-28 shrink-0 rounded-lg object-cover" onError={(event) => { event.currentTarget.hidden = true; }} />}
          <div className="min-w-0 space-y-2"><p className="break-words text-sm text-muted-foreground">{episode.podcastTitle}</p><h2 className="break-words text-xl font-semibold">{episode.title}</h2>{episode.durationSeconds !== null && <p className="text-sm text-muted-foreground"><T k="listening.podcast.episodeLength" params={{ time: formatPodcastTime(episode.durationSeconds) }} /></p>}</div>
        </div>
        <PodcastPlayer key={`${episode.podcastId}:${episode.guid}`} episode={episode} />
      </article>}
    </div>
  );
}
