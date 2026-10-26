import type { CaptionDelay, PodcastCaptionWord } from "../types/podcast";

export const CAPTION_SAMPLE_RATE = 16_000;
/**
 * Utterances are cut at the first pause after this much audio. Whistle's
 * streaming mode commits a sentence only once the next one has begun (up to
 * 11 s late), so each utterance is transcribed as soon as it ends instead.
 * Shorter cuts lose context and recognise worse.
 */
export const MIN_UTTERANCE_SECONDS = 2.5;
/** Without a pause (e.g. under music), cut anyway near this length. */
export const MAX_UTTERANCE_SECONDS = 6;
/** Quiet this long ends an utterance. */
export const PAUSE_SECONDS = 0.35;
/** Backlog beyond this means the device cannot keep up with playback. */
export const MAX_BACKLOG_SECONDS = 30;
/**
 * What the listener hears trails the decoded media by this much, so words are
 * recognised before they are heard: the longest utterance plus transcription.
 */
export const CAPTION_DELAY_SECONDS = 8;

/** Media seconds held in the delay line: its wall-clock delay at the fill rate. */
export function delayedMediaSeconds(delay: CaptionDelay): number {
  return delay.seconds * delay.rate;
}

/**
 * The position the listener actually hears while playback runs through the
 * caption delay. `anchor` is where the delay line was last emptied (enabling
 * captions, seeking or a rate change); nothing earlier is still to be heard.
 */
export function heardTime(mediaTime: number, delay: CaptionDelay | null): number {
  return delay ? Math.max(delay.anchor, mediaTime - delayedMediaSeconds(delay)) : mediaTime;
}

/** True while a freshly emptied delay line has not yet reached the speakers. */
export function delayFilling(mediaTime: number, delay: CaptionDelay | null): boolean {
  return !!delay && mediaTime - delayedMediaSeconds(delay) < delay.anchor;
}

/**
 * Stateful box-filter downsampler from the AudioContext rate to 16 kHz.
 * Carrying the fractional position across blocks avoids timestamp drift.
 */
export function createCaptionDownsampler(sourceRate: number) {
  if (!Number.isFinite(sourceRate) || sourceRate < CAPTION_SAMPLE_RATE) throw new Error("Unsupported PCM sample rate");
  const step = sourceRate / CAPTION_SAMPLE_RATE;
  let position = 0;
  let next = step;
  let sum = 0;
  let count = 0;
  return (input: Float32Array): Float32Array => {
    const output = new Float32Array(Math.ceil(input.length / step) + 1);
    let size = 0;
    for (let i = 0; i < input.length; i++) {
      sum += input[i];
      count++;
      position++;
      if (position >= next) {
        output[size++] = sum / count;
        sum = 0;
        count = 0;
        next += step;
      }
    }
    return output.subarray(0, size);
  };
}

/** Word times are relative to the stream; map them back to media time. */
export function toPodcastWords(
  words: ReadonlyArray<{ word: string; start: number; end: number }>,
  offset: number,
  playbackRate: number,
): PodcastCaptionWord[] {
  return words.filter((word) => word.word.trim() && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end >= word.start)
    .map((word) => ({
      word: word.word.trim(),
      start: offset + word.start * playbackRate,
      end: offset + word.end * playbackRate,
    }));
}

/**
 * A new pass over the same media time replaces what an earlier pass heard
 * there. The whole episode is kept so the transcript outlives playback.
 */
export function replaceCaptionWords(previous: PodcastCaptionWord[], added: PodcastCaptionWord[]): PodcastCaptionWord[] {
  if (!added.length) return previous;
  const from = added[0].start;
  const to = added[added.length - 1].end;
  const kept = previous.filter((word) => word.end <= from || word.start >= to);
  return [...kept, ...added].sort((a, b) => a.start - b.start);
}

/** The recent caption line around the playhead. */
export function visibleCaptionWords(words: PodcastCaptionWord[], time: number, count = 24): PodcastCaptionWord[] {
  return words.filter((word) => word.start <= time + 0.25 && word.end >= time - 12).slice(-count);
}

const FRAME = CAPTION_SAMPLE_RATE / 50; // 20 ms
/** Below this RMS (about -50 dBFS) a frame is silence however quiet the speech. */
const SILENCE_FLOOR = 0.003;
/** Pauses are judged against recent loudness, which halves in about 3 s. */
const PEAK_DECAY = 0.995;
/** A forced cut lands on the quietest frame within this window before the limit. */
const FORCED_CUT_WINDOW = 1.5;

/** A finished stretch of speech, `start` seconds after its playback run began. */
export interface CaptionUtterance {
  start: number;
  samples: Float32Array;
}

/**
 * Splits one continuous run of 16 kHz playback into utterances at pauses, so
 * each can be transcribed with word timestamps as soon as it ends. Pauses are
 * judged against recent loudness, which also copes with quiet beds; only
 * near-digital silence is ever discarded, so quieter speech is never lost.
 */
export class PauseSegmenter {
  #buffer = new Float32Array(0);
  #rms: number[] = [];
  #offset = 0;
  #peak = 0.02;
  #quietFrames = 0;
  #voiced = false;

  /** Seconds of audio waiting to complete an utterance. */
  get bufferedSeconds() {
    return this.#buffer.length / CAPTION_SAMPLE_RATE;
  }

  push(samples: Float32Array): CaptionUtterance[] {
    const grown = new Float32Array(this.#buffer.length + samples.length);
    grown.set(this.#buffer);
    grown.set(samples, this.#buffer.length);
    this.#buffer = grown;
    const done: CaptionUtterance[] = [];
    while ((this.#rms.length + 1) * FRAME <= this.#buffer.length) {
      const from = this.#rms.length * FRAME;
      let sum = 0;
      for (let i = from; i < from + FRAME; i++) sum += this.#buffer[i] * this.#buffer[i];
      const rms = Math.sqrt(sum / FRAME);
      this.#peak = Math.max(rms, this.#peak * PEAK_DECAY);
      const pause = rms < SILENCE_FLOOR || rms < this.#peak * 0.08;
      this.#rms.push(rms);
      this.#quietFrames = pause ? this.#quietFrames + 1 : 0;
      if (rms >= SILENCE_FLOOR) this.#voiced = true;
      const length = this.#rms.length * FRAME / CAPTION_SAMPLE_RATE;
      if (length >= MIN_UTTERANCE_SECONDS && this.#quietFrames * FRAME >= PAUSE_SECONDS * CAPTION_SAMPLE_RATE) {
        this.#cut(this.#rms.length, done);
      } else if (length >= MAX_UTTERANCE_SECONDS) {
        const window = Math.round(FORCED_CUT_WINDOW * 50);
        let quietest = this.#rms.length - 1;
        for (let k = this.#rms.length - window; k < this.#rms.length; k++) if (this.#rms[k] < this.#rms[quietest]) quietest = k;
        this.#cut(quietest + 1, done);
      }
    }
    return done;
  }

  /** The unfinished tail, when playback stops. */
  flush(): CaptionUtterance | null {
    const done: CaptionUtterance[] = [];
    if (this.#buffer.length >= CAPTION_SAMPLE_RATE / 5) {
      this.#cut(Math.ceil(this.#buffer.length / FRAME), done);
    }
    return done[0] ?? null;
  }

  #cut(frames: number, done: CaptionUtterance[]) {
    const size = Math.min(this.#buffer.length, frames * FRAME);
    // Silence carries no words; skip it but keep the timeline.
    if (this.#voiced) done.push({ start: this.#offset / CAPTION_SAMPLE_RATE, samples: this.#buffer.slice(0, size) });
    this.#buffer = this.#buffer.slice(size);
    this.#rms = this.#rms.slice(frames);
    this.#offset += size;
    this.#quietFrames = 0;
    this.#voiced = this.#rms.some((rms) => rms >= SILENCE_FLOOR);
  }
}
