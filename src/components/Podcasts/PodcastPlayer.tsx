import { useEffect, useRef, useState } from "react";
import { Captions, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import type { PodcastEpisode } from "../../types/podcast";

import { usePodcastCaptions } from "../../hooks/usePodcastCaptions";
import { delayFilling, heardTime, visibleCaptionWords } from "../../utils/podcastCaptions";
import { formatPodcastTime } from "../../utils/podcastTime";
import { PodcastTranscript } from "./PodcastTranscript";
import { T } from "../common/T";
import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey } from "../../i18n/translate";

export function PodcastPlayer({ episode }: { episode: PodcastEpisode }) {
  const { t } = useLanguage();
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
  const [error, setError] = useState<MessageKey | null>(null);
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
    setError(null);
    try { await audio.play(); } catch (cause) {
      if ((cause instanceof Error || cause instanceof DOMException) && cause.name === "AbortError") return;
      setLoading(false);
      setError((cause instanceof Error || cause instanceof DOMException) && cause.name === "NotAllowedError" ? "listening.player.error.notAllowed" : "listening.player.error.playFailed");
    }
  };
  return (
    <section aria-label={t("listening.player.label")} className="space-y-4">
      <audio ref={audioRef} src={episode.audioUrl} preload="metadata"
        onLoadedMetadata={() => { setLoading(false); sync(); }} onDurationChange={sync} onTimeUpdate={sync} onProgress={sync}
        onCanPlay={() => { setLoading(false); sync(); }} onWaiting={() => setLoading(true)}
        onPlaying={() => { setPlaying(true); setLoading(false); }} onPause={() => setPlaying(false)}
        onEnded={() => { const at = performance.now(); setPlaying(false); setEndedAt(at); setNow(at); sync(); }}
        onError={() => { setPlaying(false); setLoading(false); setError("listening.player.error.loadFailed"); }} />
      <label className="block text-sm" htmlFor="podcast-progress"><T k="listening.player.progress" /></label>
      <input id="podcast-progress" type="range" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration || 1)} disabled={!seekable || !!error}
        onChange={(event) => seek(Number(event.target.value))} aria-valuetext={`${formatPodcastTime(time)} / ${formatPodcastTime(duration)}`}
        className="w-full min-h-11 accent-accent" />
      <div className="flex justify-between text-sm tabular-nums text-muted-foreground"><span>{formatPodcastTime(time)}</span><span>{formatPodcastTime(duration || episode.durationSeconds || 0)}</span></div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" aria-label={t("listening.player.back10")} disabled={!seekable || !!error} onClick={() => seek(time - 10)} className="btn btn-ghost min-h-11 min-w-11"><RotateCcw size={20} /><T k="listening.player.tenSeconds" variant="stacked" /></button>
        <button type="button" aria-label={playing ? t("listening.pause") : t("listening.play")} onClick={() => void toggle()} className="btn btn-primary min-h-12 min-w-20">{playing ? <Pause size={20} /> : <Play size={20} />}{playing ? <T k="listening.pause" variant="stacked" /> : <T k="listening.play" variant="stacked" />}</button>
        <button type="button" aria-label={t("listening.player.forward10")} disabled={!seekable || !!error} onClick={() => seek(time + 10)} className="btn btn-ghost min-h-11 min-w-11"><T k="listening.player.tenSeconds" variant="stacked" /><RotateCw size={20} /></button>
        <label className="flex items-center gap-2 text-sm"><T k="listening.player.speed" />
          <select aria-label={t("listening.player.speed")} value={speed} className="select select-bordered min-h-11 w-24" onChange={(event) => {
            const value = Number(event.target.value); setSpeed(value); if (audioRef.current) audioRef.current.playbackRate = value;
          }}>{[0.75, 1, 1.25, 1.5].map((value) => <option key={value} value={value}>{value}x</option>)}</select>
        </label>
      </div>
      <section aria-label={t("listening.captions.title")} className="space-y-3 rounded-[10px] border border-border-hairline bg-background/60 p-4">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-base font-medium"><Captions size={20} aria-hidden="true" /><T k="listening.captions.title" variant="stacked" /></span>
          <input type="checkbox" role="switch" className="toggle toggle-accent shrink-0" checked={captions.enabled} aria-describedby="podcast-caption-status"
            onChange={(event) => event.target.checked ? captions.enable() : captions.disable()} />
        </label>
        <p id="podcast-caption-status" role={captions.state === "error" ? "alert" : "status"} className={`text-sm ${captions.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {captions.state === "off" && <T k="listening.captions.offHint" />}
          {captions.state === "loading" && (captions.progress !== null && captions.progress < 100 ? <T k="listening.captions.downloading" params={{ percent: Math.floor(captions.progress) }} /> : <T k="listening.captions.preparing" />)}
          {captions.state === "listening" && buffering && <span className="loading loading-spinner loading-sm" aria-label={t("listening.captions.buffering")} />}
          {captions.state === "listening" && !playing && <T k="listening.captions.pressPlay" />}
          {captions.state === "error" && captions.error && <T k={captions.error} />}
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
      {loading && <p role="status" className="text-sm text-muted-foreground"><T k="listening.player.loadingAudio" /></p>}
      {!loading && !seekable && !error && <p className="text-sm text-muted-foreground"><T k="listening.player.notSeekable" /></p>}
      {error && <p role="alert" className="text-sm text-destructive"><T k={error} /></p>}
    </section>
  );
}
