import type { PodcastCaptionWord } from "../types/podcast";

export const CAPTION_SAMPLE_RATE = 16_000;
/** Whistle re-decodes its open window on every pass, so fewer, larger chunks keep up better. */
export const MIN_CHUNK_SECONDS = 2;
/** Each streamed chunk must stay within Whistle's 30-second batch limit. */
export const MAX_CHUNK_SECONDS = 20;
/** Backlog beyond this means the device cannot keep up with playback. */
export const MAX_BACKLOG_SECONDS = 30;
/**
 * What the listener hears trails the decoded media by this much, so words are
 * recognised before they are heard (one 2-second chunk plus a few seconds of
 * worst-case inference).
 */
export const CAPTION_DELAY_SECONDS = 6;

/**
 * The position the listener actually hears while playback runs through the
 * caption delay. `anchor` is where the delay line was last emptied (enabling
 * captions or seeking); nothing earlier than it is still to be heard.
 */
export function heardTime(mediaTime: number, delay: { seconds: number; anchor: number } | null): number {
  return delay ? Math.max(delay.anchor, mediaTime - delay.seconds) : mediaTime;
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

/**
 * PCM for one continuous stretch of playback. Pausing, seeking, buffering or a
 * rate change ends the segment, which lets Whistle flush its final words.
 */
export class CaptionSegment {
  readonly anchor: number;
  readonly playbackRate: number;
  #queue: Float32Array[] = [];
  #queued = 0;
  #ended = false;
  #wake: (() => void) | undefined;

  constructor(anchor: number, playbackRate: number) {
    this.anchor = anchor;
    this.playbackRate = playbackRate;
  }

  get backlogSeconds() {
    return this.#queued / CAPTION_SAMPLE_RATE;
  }

  push(samples: Float32Array) {
    if (this.#ended || !samples.length) return;
    this.#queue.push(samples);
    this.#queued += samples.length;
    if (this.#queued >= MIN_CHUNK_SECONDS * CAPTION_SAMPLE_RATE) this.#notify();
  }

  end() {
    this.#ended = true;
    this.#notify();
  }

  async *chunks(): AsyncGenerator<Float32Array> {
    while (true) {
      if (this.#queued < MIN_CHUNK_SECONDS * CAPTION_SAMPLE_RATE && !this.#ended) {
        await new Promise<void>((resolve) => { this.#wake = resolve; });
        continue;
      }
      if (!this.#queued) return;
      yield this.#take(Math.min(this.#queued, MAX_CHUNK_SECONDS * CAPTION_SAMPLE_RATE));
    }
  }

  #take(size: number): Float32Array {
    const block = new Float32Array(size);
    let offset = 0;
    while (offset < size) {
      const head = this.#queue[0];
      const count = Math.min(head.length, size - offset);
      block.set(head.subarray(0, count), offset);
      offset += count;
      if (count === head.length) this.#queue.shift();
      else this.#queue[0] = head.subarray(count);
    }
    this.#queued -= size;
    return block;
  }

  #notify() {
    const wake = this.#wake;
    this.#wake = undefined;
    wake?.();
  }
}
