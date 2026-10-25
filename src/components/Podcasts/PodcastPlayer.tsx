import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import type { PodcastEpisode } from "../../types/podcast";

import { formatPodcastTime } from "../../utils/podcastTime";

export function PodcastPlayer({ episode }: { episode: PodcastEpisode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekable, setSeekable] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
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
    setTime(audio.currentTime);
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
        setTime(audio.currentTime);
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
        onEnded={() => { setPlaying(false); sync(); }}
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
      {loading && <p role="status" className="text-sm text-muted-foreground">正在載入音訊…</p>}
      {!loading && !seekable && !error && <p className="text-sm text-muted-foreground">來源尚未提供可跳轉的音訊範圍。</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
