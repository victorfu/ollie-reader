import { describe, expect, it } from "vitest";
import {
  MAX_UTTERANCE_SECONDS,
  MIN_UTTERANCE_SECONDS,
  PauseSegmenter,
  createCaptionDownsampler,
  delayFilling,
  heardTime,
  replaceCaptionWords,
  toPodcastWords,
  visibleCaptionWords,
} from "./podcastCaptions";

describe("createCaptionDownsampler", () => {
  it("downsamples 48 kHz to 16 kHz, preserving level", () => {
    const output = createCaptionDownsampler(48_000)(new Float32Array(48_000).fill(0.25));
    expect(output).toHaveLength(16_000);
    expect(output[500]).toBeCloseTo(0.25);
  });

  it("does not drift across odd-sized blocks at 44.1 kHz", () => {
    const downsample = createCaptionDownsampler(44_100);
    let total = 0;
    const blocks = 40_000; // about an hour of 4096-frame worklet messages
    for (let i = 0; i < blocks; i++) total += downsample(new Float32Array(4096)).length;
    expect(Math.abs(total - (blocks * 4096 * 16_000) / 44_100)).toBeLessThanOrEqual(1);
  });

  it("rejects rates below 16 kHz", () => {
    expect(() => createCaptionDownsampler(8_000)).toThrow();
  });
});

describe("caption word timing", () => {
  it("maps stream-relative times onto the media timeline at any speed", () => {
    expect(toPodcastWords([{ word: " hello ", start: 0.5, end: 1 }, { word: "", start: 1, end: 2 }, { word: "bad", start: 3, end: 2 }], 42, 1.5))
      .toEqual([{ word: "hello", start: 42.75, end: 43.5 }]);
  });

  it("replaces words a later pass heard over the same time, keeping order", () => {
    const earlier = [{ word: "a", start: 0, end: 1 }, { word: "old", start: 5, end: 6 }, { word: "z", start: 20, end: 21 }];
    expect(replaceCaptionWords(earlier, [{ word: "new", start: 4.9, end: 6.2 }]).map((word) => word.word)).toEqual(["a", "new", "z"]);
  });

  it("reports the heard position behind the delay line, never before its last flush", () => {
    expect(heardTime(30, null)).toBe(30);
    expect(heardTime(30, { seconds: 6, rate: 1, anchor: 10 })).toBe(24);
    // Just after enabling or seeking to 42, nothing new has been heard yet.
    expect(heardTime(44, { seconds: 6, rate: 1, anchor: 42 })).toBe(42);
    expect(delayFilling(44, { seconds: 6, rate: 1, anchor: 42 })).toBe(true);
    expect(delayFilling(48.5, { seconds: 6, rate: 1, anchor: 42 })).toBe(false);
  });

  it("converts the wall-clock delay to media time at the fill rate", () => {
    // Six seconds of 1.5x playback hold nine media seconds.
    expect(heardTime(30, { seconds: 6, rate: 1.5, anchor: 0 })).toBe(21);
    expect(delayFilling(8, { seconds: 6, rate: 1.5, anchor: 0 })).toBe(true);
  });

  it("keeps a whole episode's transcript", () => {
    const words = Array.from({ length: 12_000 }, (_, i) => ({ word: "w", start: i, end: i + 0.5 }));
    expect(replaceCaptionWords(words, [{ word: "end", start: 20_000, end: 20_001 }])).toHaveLength(12_001);
  });

  it("shows the recent line up to the playhead", () => {
    const words = Array.from({ length: 40 }, (_, i) => ({ word: `w${i}`, start: i, end: i + 0.5 }));
    const visible = visibleCaptionWords(words, 30.2);
    expect(visible.at(-1)?.word).toBe("w30");
    expect(visible[0].start).toBeGreaterThanOrEqual(18);
  });
});

describe("PauseSegmenter", () => {
  const RATE = 16_000;
  /** Seconds of a 220 Hz tone at `level`, or silence at level 0. */
  const tone = (seconds: number, level = 0.3) => Float32Array.from({ length: Math.round(seconds * RATE) }, (_, i) => level * Math.sin((2 * Math.PI * 220 * i) / RATE));
  const concat = (...parts: Float32Array[]) => {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const part of parts) { out.set(part, at); at += part.length; }
    return out;
  };
  /** Feed in worklet-sized blocks, as playback does. */
  const feed = (segmenter: PauseSegmenter, audio: Float32Array) => {
    const out = [];
    for (let i = 0; i < audio.length; i += 1365) out.push(...segmenter.push(audio.subarray(i, i + 1365)));
    return out;
  };

  it("cuts at the first pause after the minimum length, keeping short phrases together", () => {
    const segmenter = new PauseSegmenter();
    // 1.2 s phrase, short pause (too early to cut), 1.6 s phrase, then a pause.
    const utterances = feed(segmenter, concat(tone(1.2), tone(0.5, 0), tone(1.6), tone(0.6, 0), tone(1)));
    expect(utterances).toHaveLength(1);
    expect(utterances[0].start).toBe(0);
    const length = utterances[0].samples.length / RATE;
    expect(length).toBeGreaterThanOrEqual(MIN_UTTERANCE_SECONDS);
    expect(length).toBeLessThan(3.8);
    const tail = segmenter.flush()!;
    expect(tail.start).toBeCloseTo(length, 5);
  });

  it("forces a cut near the limit at the quietest moment when there is no pause", () => {
    const segmenter = new PauseSegmenter();
    // Continuous sound with a softer (not silent) dip around 5.2 s.
    const utterances = feed(segmenter, concat(tone(5.2), tone(0.1, 0.12), tone(3)));
    expect(utterances).toHaveLength(1);
    const length = utterances[0].samples.length / RATE;
    expect(length).toBeLessThanOrEqual(MAX_UTTERANCE_SECONDS);
    expect(length).toBeGreaterThan(5.2);
    expect(length).toBeLessThanOrEqual(5.3);
  });

  it("skips pure silence but keeps the timeline", () => {
    const segmenter = new PauseSegmenter();
    expect(feed(segmenter, tone(4, 0))).toEqual([]);
    feed(segmenter, tone(3));
    const tail = segmenter.flush()!;
    expect(tail.start).toBeGreaterThan(0);
    expect(tail.start + tail.samples.length / RATE).toBeCloseTo(7, 1);
  });

  it("keeps quieter speech that follows a loud passage", () => {
    const segmenter = new PauseSegmenter();
    const utterances = feed(segmenter, concat(tone(3, 0.7), tone(1, 0), tone(20, 0.02)));
    const tail = segmenter.flush();
    const kept = [...utterances, ...(tail ? [tail] : [])];
    // Everything, including the 20 s quiet section, is still sent for transcription.
    const covered = kept.reduce((total, u) => total + u.samples.length / RATE, 0);
    expect(covered).toBeGreaterThan(23);
    const last = kept.at(-1)!;
    expect(last.start + last.samples.length / RATE).toBeGreaterThan(23.5);
    expect(kept.every((u) => u.samples.length / RATE <= MAX_UTTERANCE_SECONDS + 0.5)).toBe(true);
  });

  it("flushes nothing for a negligible tail", () => {
    const segmenter = new PauseSegmenter();
    feed(segmenter, tone(0.1));
    expect(segmenter.flush()).toBeNull();
  });
});
