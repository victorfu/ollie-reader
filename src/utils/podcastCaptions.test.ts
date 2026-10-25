import { describe, expect, it } from "vitest";
import {
  CaptionSegment,
  MAX_CHUNK_SECONDS,
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

describe("CaptionSegment", () => {
  const drain = async (segment: CaptionSegment) => {
    const sizes: number[] = [];
    for await (const chunk of segment.chunks()) sizes.push(chunk.length);
    return sizes;
  };

  it("batches short blocks into at least two seconds and flushes the tail on end", async () => {
    const segment = new CaptionSegment(10, 1);
    const result = drain(segment);
    for (let i = 0; i < 5; i++) segment.push(new Float32Array(8_000));
    segment.end();
    expect(await result).toEqual([40_000]);
  });

  it("caps each chunk to Whistle's batch limit when catching up", async () => {
    const segment = new CaptionSegment(0, 1);
    segment.push(new Float32Array(16_000 * 50));
    expect(segment.backlogSeconds).toBe(50);
    segment.end();
    expect(await drain(segment)).toEqual([MAX_CHUNK_SECONDS * 16_000, MAX_CHUNK_SECONDS * 16_000, 10 * 16_000]);
  });

  it("ignores audio after it ends", async () => {
    const segment = new CaptionSegment(0, 1);
    segment.end();
    segment.push(new Float32Array(16_000));
    expect(await drain(segment)).toEqual([]);
  });
});
