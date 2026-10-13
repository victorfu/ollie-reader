import { useAuth } from "../../hooks/useAuth";
import { usePodcastTranscript } from "../../hooks/usePodcastTranscript";
import type { PodcastEpisode } from "../../types/podcast";
import { PodcastPlayer } from "./PodcastPlayer";
import { PodcastTranscript } from "./PodcastTranscript";

export function PodcastTranscriptionPlayer({ episode }: { episode: PodcastEpisode }) {
  const { user } = useAuth();
  const { state, generate, check } = usePodcastTranscript(user, episode);
  return <PodcastPlayer key={`${episode.podcastId}:${episode.guid}`} episode={episode}>
    {state.status === "completed" ? <PodcastTranscript transcript={state.transcript} /> :
      <section aria-label="英文字幕" className="space-y-3 border-t border-border-hairline pt-5">
        <p className="text-sm text-muted-foreground">使用 Gemini 將這集 Podcast 轉成英文逐字稿。</p>
        <p className="text-xs text-muted-foreground">目前支援最長 30 分鐘、80 MiB 的音訊，產生可能需要數分鐘。</p>
        {(state.status === "checking-cache" || state.status === "generating") ? <p role="status" className="flex items-center gap-2"><span className="loading loading-spinner loading-sm" />{state.status === "checking-cache" ? "正在檢查已儲存字幕…" : "正在產生英文字幕…"}</p> : <>
          {state.status === "failed" && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!user} onClick={generate} className="btn btn-primary min-h-11">{state.status === "failed" ? "重試產生英文字幕" : "產生英文字幕"}</button>
            {state.status === "failed" && <button type="button" disabled={!user} onClick={check} className="btn btn-outline min-h-11">重新檢查字幕</button>}
          </div>
        </>}
      </section>}
  </PodcastPlayer>;
}
