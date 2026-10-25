import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import { PODCAST_API_BASE_URL } from "../constants/api";
import type { CaptionDelay, PodcastCaptionWord, PodcastEpisode } from "../types/podcast";
import { logger } from "../utils/logger";
import {
  CAPTION_DELAY_SECONDS,
  CaptionSegment,
  MAX_BACKLOG_SECONDS,
  createCaptionDownsampler,
  heardTime,
  replaceCaptionWords,
  toPodcastWords,
} from "../utils/podcastCaptions";

export type PodcastCaptionStatus = "off" | "loading" | "listening" | "error";

// The worklet hears the media immediately; the speakers hear it through an
// optional DelayNode, so captions can be ready before the words are heard.
type Graph = { source: MediaElementAudioSourceNode; worklet: AudioWorkletNode; output: AudioNode };

// createMediaElementSource() may be called only once per media element, and
// from then on the element is heard only through this context. Keep the graph
// for the element's lifetime, even while captions are off.
// `endedAt` is the context time the media ended, while the delay line still plays its tail.
type Capture = { context: AudioContext; graph?: Graph; ready?: Promise<Graph>; delay: CaptionDelay | null; endedAt: number | null };
const captures = new WeakMap<HTMLAudioElement, Capture>();

/** Must run inside the click that enables captions, so the context may start. */
function contextFor(audio: HTMLAudioElement): Capture {
  let capture = captures.get(audio);
  if (!capture) {
    const context = new AudioContext();
    const created: Capture = { context, delay: null, endedAt: null };
    capture = created;
    captures.set(audio, created);
    audio.addEventListener("play", () => void context.resume());
    audio.addEventListener("ended", () => { created.endedAt = context.currentTime; });
    for (const type of ["play", "seeking", "emptied"]) audio.addEventListener(type, () => { created.endedAt = null; });
    // Freeze the delay line with the media, so pausing never plays on or loses audio.
    audio.addEventListener("pause", () => { if (created.delay && !audio.ended) void context.suspend(); });
  }
  void capture.context.resume();
  return capture;
}

function connect(audio: HTMLAudioElement, capture: Capture): Promise<Graph> {
  capture.ready ??= (async () => {
    const { context } = capture;
    await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}podcast-caption-capture.js`);
    const source = context.createMediaElementSource(audio);
    const worklet = new AudioWorkletNode(context, "podcast-caption-capture", { numberOfInputs: 1, numberOfOutputs: 0 });
    source.connect(context.destination);
    source.connect(worklet);
    capture.graph = { source, worklet, output: context.destination };
    return capture.graph;
  })();
  return capture.ready;
}

/** Route playback through a fresh (empty) delay line, or straight to the speakers. */
function route(audio: HTMLAudioElement, capture: Capture, delayed: boolean) {
  const { context, graph } = capture;
  if (!graph) return;
  graph.source.disconnect(graph.output);
  if (graph.output !== context.destination) graph.output.disconnect();
  if (delayed) {
    const delay = new DelayNode(context, { delayTime: CAPTION_DELAY_SECONDS, maxDelayTime: CAPTION_DELAY_SECONDS });
    delay.connect(context.destination);
    graph.output = delay;
    capture.delay = { seconds: CAPTION_DELAY_SECONDS, rate: audio.playbackRate, anchor: audio.currentTime };
  } else {
    graph.output = context.destination;
    capture.delay = null;
  }
  graph.source.connect(graph.output);
}

/** What the speakers have played, including the tail drained after the media ended. */
function audibleTime(audio: HTMLAudioElement, capture: Capture): number {
  const heard = heardTime(audio.currentTime, capture.delay);
  if (!audio.ended || capture.endedAt === null || !capture.delay) return heard;
  return Math.min(audio.currentTime, heard + (capture.context.currentTime - capture.endedAt) * capture.delay.rate);
}

/** Leave delayed playback without skipping what was decoded but not yet heard. */
function undelay(audio: HTMLAudioElement, capture: Capture) {
  if (!capture.delay) return;
  const heard = audibleTime(audio, capture);
  const unheard = heard < audio.currentTime - 0.05;
  // The ending may still be draining from the delay line: replay it directly.
  const drainingTail = audio.ended && unheard;
  route(audio, capture, false);
  if (unheard) audio.currentTime = heard;
  if (drainingTail) void audio.play().catch(() => {});
  if (!audio.paused || drainingTail) void capture.context.resume();
}

/** Resolves once response headers prove the browser may read the bytes. */
async function readable(url: string, signal: AbortSignal): Promise<boolean> {
  const probe = new AbortController();
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit", signal: AbortSignal.any([signal, probe.signal, AbortSignal.timeout(10_000)]) });
    return response.ok;
  } catch {
    signal.throwIfAborted();
    return false;
  } finally {
    probe.abort();
  }
}

function loaded(audio: HTMLAudioElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (error?: unknown) => {
      audio.removeEventListener("loadedmetadata", ok);
      audio.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error);
      else resolve();
    };
    const ok = () => done();
    const failed = () => done(new Error("無法以字幕模式載入這個音訊來源；播放不受影響。"));
    const aborted = () => done(signal.reason);
    audio.addEventListener("loadedmetadata", ok);
    audio.addEventListener("error", failed);
    signal.addEventListener("abort", aborted);
  });
}

async function load(audio: HTMLAudioElement, url: string, crossOrigin: boolean, at: number, resume: boolean, signal: AbortSignal) {
  if (crossOrigin) audio.crossOrigin = "anonymous";
  else audio.removeAttribute("crossorigin");
  audio.src = url;
  audio.load();
  await loaded(audio, signal);
  if (at > 0) audio.currentTime = at;
  // load() pauses without a pause event; keep the player's state in sync.
  if (resume) await audio.play().catch(() => audio.dispatchEvent(new Event("pause")));
  else audio.dispatchEvent(new Event("pause"));
}

/**
 * Web Audio hears cross-origin media only when it was fetched with CORS;
 * otherwise it outputs silence. Reload the episode from a CORS-readable
 * source before capture: the host itself when it allows CORS, else the
 * backend's signed relay.
 */
async function ensureReadableSource(audio: HTMLAudioElement, episode: PodcastEpisode, signal: AbortSignal) {
  const current = new URL(audio.currentSrc || audio.src, window.location.href);
  if (audio.crossOrigin === "anonymous" || current.origin === window.location.origin) return;
  const relay = episode.captionAudioUrl ? new URL(episode.captionAudioUrl, `${PODCAST_API_BASE_URL}/`).href : null;
  let url: string | null = null;
  if (await readable(episode.audioUrl, signal)) url = episode.audioUrl;
  else if (relay && await readable(relay, signal)) url = relay;
  if (!url) throw new Error("這個節目的音訊主機不允許瀏覽器讀取，暫時無法產生字幕；播放不受影響。");
  const at = audio.currentTime;
  const resume = !audio.paused;
  try {
    await load(audio, url, true, at, resume, signal);
  } catch (error) {
    // Never leave the player broken: fall back to the original source.
    await load(audio, current.href, false, at, resume, new AbortController().signal).catch(() => {});
    throw error;
  }
}

const SEGMENT_BREAKS = ["pause", "seeking", "waiting", "ratechange", "ended", "emptied"] as const;
const SEGMENT_STARTS = ["playing", "seeked", "canplay"] as const;

export function usePodcastCaptions(audioRef: RefObject<HTMLAudioElement | null>, episode: PodcastEpisode) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<PodcastCaptionStatus>("off");
  const [error, setError] = useState("");
  const [words, setWords] = useState<PodcastCaptionWord[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [delay, setDelay] = useState<CaptionDelay | null>(null);

  const enable = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!window.AudioContext || !window.AudioWorkletNode) {
      setError("這個瀏覽器不支援即時字幕需要的音訊處理功能。");
      setState("error");
      return;
    }
    contextFor(audio);
    setError("");
    setProgress(null);
    setState("loading");
    setEnabled(true);
  }, [audioRef]);

  const disable = useCallback(() => {
    const audio = audioRef.current;
    const capture = audio ? captures.get(audio) : undefined;
    if (audio && capture) undelay(audio, capture);
    setDelay(null);
    setEnabled(false);
    setState("off");
  }, [audioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    const capture = audio ? captures.get(audio) : undefined;
    if (!enabled || !audio || !capture) return;
    const controller = new AbortController();
    const { signal } = controller;
    // `segment` receives audio now; `queue` holds ended or live segments that
    // Whistle has not reached yet, so capture never waits on inference.
    let segment: CaptionSegment | undefined;
    let recognising: CaptionSegment | undefined;
    const queue: CaptionSegment[] = [];
    let listening = false;
    let wakeLoop: (() => void) | undefined;
    let downsample: ((input: Float32Array) => Float32Array) | undefined;
    let worklet: AudioWorkletNode | undefined;
    let closeSpeech: (() => void) | undefined;
    const wake = () => {
      const resume = wakeLoop;
      wakeLoop = undefined;
      resume?.();
    };
    signal.addEventListener("abort", wake);
    const stop = (message: string) => {
      if (signal.aborted) return;
      controller.abort();
      segment?.end();
      for (const pending of queue) pending.end();
      closeSpeech?.();
      undelay(audio, capture);
      setDelay(null);
      setError(message);
      setState("error");
    };
    const startSegment = () => {
      if (!listening || signal.aborted || segment || audio.paused || audio.seeking || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
      segment = new CaptionSegment(audio.currentTime, audio.playbackRate);
      downsample = createCaptionDownsampler(capture.context.sampleRate);
      queue.push(segment);
      wake();
    };
    const breakSegment = () => {
      segment?.end();
      segment = undefined;
      // A rate change keeps playing without a new "playing" event.
      startSegment();
    };
    // After a seek the delay line still holds audio from the old position.
    const flush = () => {
      if (!capture.delay) return;
      route(audio, capture, true);
      setDelay(capture.delay);
    };
    // The delay line was filled at the old rate: re-anchor at what was heard
    // and refill at the new rate, so nothing is skipped or mistimed.
    const rerate = () => {
      const delay = capture.delay;
      if (!delay || delay.rate === audio.playbackRate) return;
      audio.currentTime = heardTime(audio.currentTime, delay);
      flush();
    };
    audio.addEventListener("ratechange", rerate);
    for (const type of SEGMENT_BREAKS) audio.addEventListener(type, breakSegment);
    for (const type of SEGMENT_STARTS) audio.addEventListener(type, startSegment);
    audio.addEventListener("seeking", flush);

    void (async () => {
      try {
        const { createWhistle } = await import("cactus-needle/browser");
        const loading = createWhistle({ abortSignal: signal, onDownloadProgress: ({ percentage }) => setProgress(percentage ?? null) })
          .then((whistle) => {
            let closed = false;
            closeSpeech = () => { if (!closed) { closed = true; void whistle.close(); } };
            if (signal.aborted) closeSpeech();
            return whistle;
          });
        // Model download and source preparation overlap; both must succeed.
        const [whistle] = await Promise.all([loading, ensureReadableSource(audio, episode, signal)]);
        signal.throwIfAborted();
        worklet = (await connect(audio, capture)).worklet;
        signal.throwIfAborted();
        route(audio, capture, true);
        setDelay(capture.delay);
        worklet.port.onmessage = (event: MessageEvent<{ samples: Float32Array }>) => {
          if (!segment || !downsample) return;
          segment.push(downsample(event.data.samples));
          const waiting = new Set([recognising, ...queue, segment]);
          let backlog = 0;
          for (const pending of waiting) backlog += pending?.backlogSeconds ?? 0;
          if (backlog > MAX_BACKLOG_SECONDS) stop("這台裝置的辨識速度跟不上播放，字幕已停止；音訊仍可正常播放。");
        };
        setState("listening");
        listening = true;
        startSegment();
        while (!signal.aborted) {
          const current = queue.shift();
          if (!current) {
            await new Promise<void>((resolve) => { wakeLoop = resolve; });
            continue;
          }
          recognising = current;
          for await (const part of whistle.stream(current.chunks(), { language: "en" })) {
            if (signal.aborted) break;
            const heard = toPodcastWords(part.words, current.anchor, current.playbackRate);
            if (heard.length) setWords((previous) => replaceCaptionWords(previous, heard));
          }
          recognising = undefined;
        }
      } catch (cause) {
        if (signal.aborted) return;
        logger.error("Podcast captions failed", cause);
        // Our own messages are user-facing Chinese; engine errors are not.
        const message = cause instanceof Error && /[一-鿿]/.test(cause.message) ? cause.message : "無法啟動即時字幕，請稍後再試；音訊仍可正常播放。";
        stop(message);
      }
    })();

    return () => {
      controller.abort();
      segment?.end();
      for (const pending of queue) pending.end();
      audio.removeEventListener("ratechange", rerate);
      for (const type of SEGMENT_BREAKS) audio.removeEventListener(type, breakSegment);
      for (const type of SEGMENT_STARTS) audio.removeEventListener(type, startSegment);
      audio.removeEventListener("seeking", flush);
      if (worklet) worklet.port.onmessage = null;
      closeSpeech?.();
    };
  }, [enabled, audioRef, episode]);

  // The audio element lives exactly as long as this player (keyed per
  // episode), so its routing is released only on unmount.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      const capture = audio ? captures.get(audio) : undefined;
      if (!audio || !capture) return;
      captures.delete(audio);
      if (capture.graph) capture.graph.worklet.port.onmessage = null;
      void capture.context.close();
    };
  }, [audioRef]);

  return { enabled, state, error, words, progress, delay, enable, disable };
}
