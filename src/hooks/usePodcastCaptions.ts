import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { resamplePodcastPcm, toPodcastWords, type PodcastCaptionWord } from "../utils/podcastCaptions";

type CaptionState = "off" | "loading" | "listening" | "error";
type SpeechSession = Awaited<ReturnType<typeof import("cactus-needle/browser").createWhistle>>;

export function usePodcastCaptions(audioRef: RefObject<HTMLAudioElement | null>, identity: string) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<CaptionState>("off");
  const [error, setError] = useState("");
  const [words, setWords] = useState<PodcastCaptionWord[]>([]);
  const [pending, setPending] = useState("");
  const generation = useRef(0);
  const cleanup = useRef<() => void>(() => {});
  const enable = () => setEnabled(true);
  const disable = () => setEnabled(false);

  useEffect(() => {
    if (!enabled) {
      cleanup.current();
      setState("off");
      setWords([]);
      setPending("");
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    const run = ++generation.current;
    let disposed = false;
    let context: AudioContext | undefined;
    let processor: AudioWorkletNode | undefined;
    let source: MediaElementAudioSourceNode | undefined;
    let speech: SpeechSession | undefined;
    const queued: Float32Array[] = [];
    let notify: (() => void) | undefined;
    let streamOffset = audio.currentTime;
    let received = 0;
    let rate = audio.playbackRate;
    let active = true;
    const valid = () => !disposed && generation.current === run;
    const reset = () => {
      streamOffset = audio.currentTime;
      received = 0;
      rate = audio.playbackRate;
      queued.length = 0;
      setWords([]);
      setPending("");
    };
    const stop = () => {
      disposed = true;
      active = false;
      generation.current++;
      queued.length = 0;
      notify?.();
      processor?.disconnect();
      if (processor) processor.port.onmessage = null;
      // Never disconnect the media source from the destination during teardown:
      // the HTML audio element must remain audible after captions are disabled.
      void speech?.close();
      void context?.close();
    };
    cleanup.current = stop;
    const start = async () => {
      setState("loading");
      setError("");
      try {
        if (!window.AudioContext || !window.AudioWorkletNode) throw new Error("此瀏覽器不支援 AudioWorklet 字幕辨識。");
        const { createWhistle } = await import("cactus-needle/browser");
        if (!valid()) return;
        speech = await createWhistle();
        if (!valid()) { await speech.close(); return; }
        context = new AudioContext();
        await context.audioWorklet.addModule("/podcast-caption-capture.js");
        if (!valid()) return;
        source = context.createMediaElementSource(audio);
        source.connect(context.destination);
        processor = new AudioWorkletNode(context, "podcast-caption-capture", { numberOfOutputs: 0 });
        source.connect(processor);
        processor.port.onmessage = (event: MessageEvent<{ samples: Float32Array }>) => {
          if (!valid() || !active || audio.paused) return;
          // Streaming needs 16 kHz mono. Drop backlogged chunks rather than
          // growing memory without bounds on slow devices.
          if (queued.length > 32) { queued.shift(); }
          queued.push(resamplePodcastPcm(event.data.samples, context!.sampleRate));
          notify?.();
          notify = undefined;
        };
        const chunks = async function* () {
          while (active) {
            if (!queued.length) await new Promise<void>((resolve) => { notify = resolve; });
            while (queued.length) {
              const chunk = queued.shift()!;
              received += chunk.length / 16_000;
              yield chunk;
            }
          }
        };
        if (!audio.paused) await context.resume();
        setState("listening");
        // The SDK produces committed words and an unconfirmed trailing phrase.
        for await (const part of speech.stream(chunks(), { language: "en" })) {
          if (!valid()) break;
          const mapped = toPodcastWords(part.words, streamOffset, rate);
          setWords((previous) => [...previous, ...mapped].slice(-400));
          setPending(part.pending);
        }
      } catch (cause) {
        if (!valid()) return;
        setError(cause instanceof Error ? cause.message : "無法啟用字幕辨識");
        setState("error");
        // Keep ordinary HTMLAudioElement playback enabled.
      }
    };
    const seek = () => {
      // The streaming model cannot be repositioned. Rebuild the session when
      // seeking or changing rate to avoid assigning incorrect word timestamps.
      if (valid()) { stop(); setEnabled(false); }
    };
    const resume = () => { if (!disposed) void context?.resume(); };
    audio.addEventListener("seeking", seek);
    audio.addEventListener("ratechange", seek);
    audio.addEventListener("playing", resume);
    void start();
    return () => {
      stop();
      audio.removeEventListener("seeking", seek);
      audio.removeEventListener("ratechange", seek);
      audio.removeEventListener("playing", resume);
    };
  }, [enabled, identity, audioRef]);

  return { enabled, enable, disable, state, error, words, pending };
}
