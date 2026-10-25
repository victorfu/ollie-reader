import { useEffect, useRef, useState } from "react";
import { Captions, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import type { PodcastEpisode } from "../../types/podcast";

import { usePodcastCaptions } from "../../hooks/usePodcastCaptions";
import { delayFilling, heardTime, visibleCaptionWords } from "../../utils/podcastCaptions";
import { formatPodcastTime } from "../../utils/podcastTime";
import { PodcastTranscript } from "./PodcastTranscript";

export function PodcastPlayer({ episode }: { episode: PodcastEpisode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mediaTime, setMediaTime] = useState(0);
  // When media ends, the delay line still plays its tail; this is when it began.
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekable, setSeekable] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
  const captions = usePodcastCaptions(audioRef, episode);
  // With captions on, the speakers trail the decoded media; show what is heard.
  const tail = endedAt === null ? 0 : Math.max(0, (now - endedAt) / 1000) * speed;
  const time = Math.min(mediaTime, heardTime(mediaTime, captions.delay) + tail);
  const draining = endedAt !== null && time < mediaTime;
  // Right after enabling or seeking, the delay line is still filling.
  const buffering = playing && delayFilling(mediaTime, captions.delay);
  useEffect(() => {
    if (!draining) return;
    const timer = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [draining]);
  const captionWords = visibleCaptionWords(captions.words, time);
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.src = episode.audioUrl;
      audio.load();
    }
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, [episode.audioUrl]);
  const sync = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setMediaTime(audio.currentTime);
    if (!audio.ended) setEndedAt(null);
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    setSeekable(audio.seekable.length > 0);
  };
  const seek = (target: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.seekable.length) return;
    // Clamp to a range the host actually allows, not just the RSS duration.
    for (let i = 0; i < audio.seekable.length; i++) {
      if (target <= audio.seekable.end(i) || i === audio.seekable.length - 1) {
        audio.currentTime = Math.max(audio.seekable.start(i), Math.min(target, audio.seekable.end(i)));
        setMediaTime(audio.currentTime);
        setEndedAt(null);
        break;
      }
    }
  };
  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    setError("");
    try { await audio.play(); } catch (cause) {
      if ((cause instanceof Error || cause instanceof DOMException) && cause.name === "AbortError") return;
      setLoading(false);
      setError((cause instanceof Error || cause instanceof DOMException) && cause.name === "NotAllowedError" ? "瀏覽器尚未允許播放，請再按一次播放。" : "無法播放音訊，請確認網路、重新載入單集，或使用其他瀏覽器。");
    }
  };
  return (
    <section aria-label="Podcast 播放器" className="space-y-4">
      <audio ref={audioRef} src={episode.audioUrl} preload="metadata"
        onLoadedMetadata={() => { setLoading(false); sync(); }} onDurationChange={sync} onTimeUpdate={sync} onProgress={sync}
        onCanPlay={() => { setLoading(false); sync(); }} onWaiting={() => setLoading(true)}
        onPlaying={() => { setPlaying(true); setLoading(false); }} onPause={() => setPlaying(false)}
        onEnded={() => { const at = performance.now(); setPlaying(false); setEndedAt(at); setNow(at); sync(); }}
        onError={() => { setPlaying(false); setLoading(false); setError("音訊無法載入：來源可能已失效、網路中斷或格式不受支援。請重新載入單集。"); }} />
      <label className="block text-sm" htmlFor="podcast-progress">播放進度</label>
      <input id="podcast-progress" type="range" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration || 1)} disabled={!seekable || !!error}
        onChange={(event) => seek(Number(event.target.value))} aria-valuetext={`${formatPodcastTime(time)} / ${formatPodcastTime(duration)}`}
        className="w-full min-h-11 accent-accent" />
      <div className="flex justify-between text-sm tabular-nums text-muted-foreground"><span>{formatPodcastTime(time)}</span><span>{formatPodcastTime(duration || episode.durationSeconds || 0)}</span></div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" aria-label="倒退 10 秒" disabled={!seekable || !!error} onClick={() => seek(time - 10)} className="btn btn-ghost min-h-11 min-w-11"><RotateCcw size={20} />10 秒</button>
        <button type="button" aria-label={playing ? "暫停" : "播放"} onClick={() => void toggle()} className="btn btn-primary min-h-12 min-w-20">{playing ? <Pause size={20} /> : <Play size={20} />}{playing ? "暫停" : "播放"}</button>
        <button type="button" aria-label="快轉 10 秒" disabled={!seekable || !!error} onClick={() => seek(time + 10)} className="btn btn-ghost min-h-11 min-w-11">10 秒<RotateCw size={20} /></button>
        <label className="flex items-center gap-2 text-sm">播放速度
          <select aria-label="播放速度" value={speed} className="select select-bordered min-h-11 w-24" onChange={(event) => {
            const value = Number(event.target.value); setSpeed(value); if (audioRef.current) audioRef.current.playbackRate = value;
          }}>{[0.75, 1, 1.25, 1.5].map((value) => <option key={value} value={value}>{value}x</option>)}</select>
        </label>
      </div>
      <section aria-label="英文即時字幕" className="space-y-3 rounded-[10px] border border-border-hairline bg-background/60 p-4">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-base font-medium"><Captions size={20} aria-hidden="true" />英文即時字幕</span>
          <input type="checkbox" role="switch" className="toggle toggle-accent shrink-0" checked={captions.enabled} aria-describedby="podcast-caption-status"
            onChange={(event) => event.target.checked ? captions.enable() : captions.disable()} />
        </label>
        <p id="podcast-caption-status" role={captions.state === "error" ? "alert" : "status"} className={`text-sm ${captions.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {captions.state === "off" && "在瀏覽器本機辨識英文，不上傳音訊。第一次開啟需下載約 17 MB 的語音模型。"}
          {captions.state === "loading" && (captions.progress !== null && captions.progress < 100 ? `正在下載語音模型… ${Math.floor(captions.progress)}%` : "正在準備語音模型與音訊…")}
          {captions.state === "listening" && buffering && <span className="loading loading-spinner loading-sm" aria-label="字幕緩衝中" />}
          {captions.state === "listening" && !playing && "按下播放後開始顯示字幕。"}
          {captions.state === "error" && captions.error}
        </p>
        {((captions.enabled && captions.state !== "error") || captions.words.length > 0) && (
          <p lang="en" className="min-h-20 rounded-lg bg-base-200/50 p-3 text-lg leading-relaxed break-words">
            {captionWords.map((word, index) => (
              <span key={`${word.start}-${index}`} className={word.start <= time && time < word.end ? "rounded bg-accent/15 text-accent" : undefined}>{word.word} </span>
            ))}
          </p>
        )}
        <PodcastTranscript words={captions.words} time={time} onSeek={seek} />
      </section>
      {loading && <p role="status" className="text-sm text-muted-foreground">正在載入音訊…</p>}
      {!loading && !seekable && !error && <p className="text-sm text-muted-foreground">來源尚未提供可跳轉的音訊範圍。</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
