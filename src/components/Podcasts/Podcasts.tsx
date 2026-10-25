import { useEffect, useRef, useState, type FormEvent } from "react";
import { Headphones } from "lucide-react";
import { resolvePodcast } from "../../services/podcastService";
import type { PodcastEpisode, PodcastShow } from "../../types/podcast";
import { PodcastPlayer } from "./PodcastPlayer";
import { formatPodcastTime } from "../../utils/podcastTime";

export default function Podcasts() {
  const [url, setUrl] = useState("");
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [show, setShow] = useState<PodcastShow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const load = async (event: FormEvent) => {
    event.preventDefault();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(""); setEpisode(null); setShow(null);
    try {
      const result = await resolvePodcast(url.trim(), controller.signal);
      if (!controller.signal.aborted) {
        if ("episodes" in result) setShow(result);
        else setEpisode(result);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && cause.name === "TimeoutError" ? "載入逾時，請稍後再試。" : cause instanceof TypeError ? "無法連線 Podcast 服務，請確認網路後重試。" : cause instanceof Error ? cause.message : "無法載入 Podcast");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <header className="space-y-2"><h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight"><Headphones className="shrink-0" />Podcast 聽力</h1><p className="text-muted-foreground">貼上 Apple Podcasts 節目或單集連結，一起聽故事吧！</p></header>
      <form onSubmit={(event) => void load(event)} className="space-y-2">
        <label htmlFor="podcast-url" className="text-sm font-medium">Apple Podcasts 網址</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="podcast-url" type="url" required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://podcasts.apple.com/…?i=…" className="input input-bordered min-h-11 w-full min-w-0 flex-1" />
          <button type="submit" disabled={loading || !url.trim()} className="btn btn-primary min-h-11 shrink-0">{loading ? "載入中…" : "載入 Podcast"}</button>
        </div>
        <p className="text-xs text-muted-foreground">節目連結會列出可播放的單集；單集連結會直接載入該集。</p>
      </form>
      {loading && <p role="status">正在載入 Podcast 資料…</p>}
      {error && <p role="alert" className="rounded-lg border border-border-hairline bg-background p-4 text-destructive">{error}</p>}
      {show && <section aria-label="節目單集" className="min-w-0 space-y-3 rounded-xl border border-border-hairline bg-background p-4 shadow-sm">
        <h2 className="break-words text-xl font-semibold">{show.podcastTitle}</h2>
        <p className="text-sm text-muted-foreground">{show.episodes.length} 集可播放，選一集來聽吧！</p>
        <label htmlFor="podcast-episode" className="block text-sm font-medium">選擇單集</label>
        <select id="podcast-episode" className="select select-bordered min-h-11 w-full min-w-0" value={episode?.guid ?? ""}
          onChange={(event) => setEpisode(show.episodes.find((item) => item.guid === event.target.value) ?? null)}>
          <option value="" disabled>請選擇想聽的單集</option>
          {show.episodes.map((item) => <option key={item.guid} value={item.guid}>{item.title}{item.durationSeconds === null ? "" : `（${formatPodcastTime(item.durationSeconds)}）`}</option>)}
        </select>
        {show.unavailableCount > 0 && <p className="text-xs text-muted-foreground">另有 {show.unavailableCount} 集缺少可播放或唯一識別的資料。</p>}
      </section>}
      {episode && <article className="space-y-6 rounded-xl border border-border-hairline bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          {episode.artworkUrl && <img src={episode.artworkUrl} alt="" referrerPolicy="no-referrer" className="size-28 shrink-0 rounded-lg object-cover" onError={(event) => { event.currentTarget.hidden = true; }} />}
          <div className="min-w-0 space-y-2"><p className="break-words text-sm text-muted-foreground">{episode.podcastTitle}</p><h2 className="break-words text-xl font-semibold">{episode.title}</h2>{episode.durationSeconds !== null && <p className="text-sm text-muted-foreground">單集長度 {formatPodcastTime(episode.durationSeconds)}</p>}</div>
        </div>
        <PodcastPlayer key={`${episode.podcastId}:${episode.guid}`} episode={episode} />
      </article>}
    </div>
  );
}
