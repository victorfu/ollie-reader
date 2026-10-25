import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { resamplePodcastPcm, toPodcastWords, type PodcastCaptionWord } from "../utils/podcastCaptions";

type Status = "off" | "loading" | "listening" | "error";
type WhistleSession = Awaited<ReturnType<typeof import("cactus-needle/browser").createWhistle>>;

// createMediaElementSource() may be called only once per media element.
// Keep its routing alive even when the STT model is turned off.
type Capture = { context: AudioContext; capture: AudioWorkletNode };
const captures = new WeakMap<HTMLAudioElement, Capture>();

async function getCapture(audio: HTMLAudioElement): Promise<Capture> {
  const existing = captures.get(audio);
  if (existing) return existing;
  const context = new AudioContext();
  try {
    await context.audioWorklet.addModule("/podcast-caption-capture.js");
    const source = context.createMediaElementSource(audio);
    const capture = new AudioWorkletNode(context, "podcast-caption-capture", { numberOfOutputs: 0 });
    source.connect(context.destination);
    source.connect(capture);
    const result = { context, capture };
    captures.set(audio, result);
    return result;
  } catch (error) {
    await context.close();
    throw error;
  }
}

export function usePodcastCaptions(audioRef: RefObject<HTMLAudioElement | null>, identity: string) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<Status>("off");
  const [error, setError] = useState("");
  const [words, setWords] = useState<PodcastCaptionWord[]>([]);
  const [pending, setPending] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setState("off");
      setPending("");
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    const run = ++generation.current;
    let disposed = false;
    let active = true;
    let speech: WhistleSession | undefined;
    let capture: Capture | undefined;
    let wake: (() => void) | undefined;
    const samples: Float32Array[] = [];
    let buffered = 0;
    let streamStart = audio.currentTime;
    const speed = audio.playbackRate;
    const valid = () => !disposed && generation.current === run;
    const finish = () => {
      disposed = true;
      active = false;
      samples.length = 0;
      buffered = 0;
      wake?.();
      if (capture) capture.capture.port.onmessage = null;
      void speech?.close();
    };

    const resetOnSeek = () => {
      // A live stream cannot be seeked. Stop captions rather than display
      // inaccurate timestamps. The user may switch them on at the new time.
      if (valid()) setEnabled(false);
    };
    const resume = () => { if (capture && !audio.paused) void capture.context.resume(); };
    audio.addEventListener("seeking", resetOnSeek);
    audio.addEventListener("ratechange", resetOnSeek);
    audio.addEventListener("playing", resume);
    setWords([]);
    setPending("");
    setError("");
    setState("loading");

    const start = async () => {
      try {
        if (!window.AudioContext || !window.AudioWorkletNode) throw new Error("瀏覽器不支援 AudioWorklet。");
        const { createWhistle } = await import("cactus-needle/browser");
        speech = await createWhistle();
        if (!valid()) { await speech.close(); return; }
        // Cross-origin media without an explicit CORS-enabled source becomes
        // silent when attached to Web Audio. Never compromise playback.
        const sourceUrl = new URL(audio.currentSrc || audio.src, window.location.href);
        if (sourceUrl.origin !== window.location.origin) {
          throw new Error("目前 Podcast 音檔來自其他網域，直接擷取會使播放器靜音。此來源暫不支援本機字幕，播放功能不受影響。");
        }
        capture = await getCapture(audio);
        if (!valid()) return;
        // Assign the clock anchor immediately before streaming begins.
        streamStart = audio.currentTime;
        capture.capture.port.onmessage = (event: MessageEvent<{ samples: Float32Array }>) => {
          if (!valid() || audio.paused) return;
          const pcm = resamplePodcastPcm(event.data.samples, capture!.context.sampleRate);
          samples.push(pcm);
          buffered += pcm.length;
          // Stop instead of silently dropping samples (which would corrupt timestamps).
          if (buffered > 16_000 * 12) {
            setError("裝置辨識速度不足，字幕已停止，音訊仍可正常播放。");
            setState("error");
            setEnabled(false);
            return;
          }
          wake?.();
          wake = undefined;
        };
        if (!audio.paused) await capture.context.resume();
        setState("listening");
        async function* chunks() {
          let partial: Float32Array[] = [];
          let size = 0;
          while (active) {
            if (!samples.length) await new Promise<void>((resolve) => { wake = resolve; });
            while (samples.length && active) {
              const chunk = samples.shift()!;
              buffered -= chunk.length;
              partial.push(chunk);
              size += chunk.length;
              if (size < 16_000) continue;
              const block = new Float32Array(size);
              let position = 0;
              for (const part of partial) { block.set(part, position); position += part.length; }
              partial = []; size = 0;
              yield block;
            }
          }
        }
        for await (const part of speech.stream(chunks(), { language: "en" })) {
          if (!valid()) break;
          const mapped = toPodcastWords(part.words, streamStart, speed);
          setWords((previous) => [...previous, ...mapped].slice(-400));
          setPending(part.pending);
        }
      } catch (cause) {
        if (!valid()) return;
        setError(cause instanceof Error ? cause.message : "無法產生字幕");
        setState("error");
      }
    };
    void start();
    return () => {
      finish();
      audio.removeEventListener("seeking", resetOnSeek);
      audio.removeEventListener("ratechange", resetOnSeek);
      audio.removeEventListener("playing", resume);
    };
  }, [enabled, identity, audioRef]);

  // The player owns audioRef. A distinct effect releases audio resources
  // only on final unmount, never on a caption toggle.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (!audio) return;
      const current = captures.get(audio);
      if (current) {
        current.capture.port.onmessage = null;
        void current.context.close();
        captures.delete(audio);
      }
    };
  }, [audioRef, identity]);

  return { enabled, enable: () => setEnabled(true), disable: () => setEnabled(false), state, error, words, pending };
}
