import { describe, expect, it } from "vitest";
import { resamplePodcastPcm, toPodcastWords } from "./podcastCaptions";

describe("Podcast caption audio helpers", () => {
  it("resamples 48 kHz PCM to 16 kHz, preserving duration", () => {
    const source = new Float32Array(48_000).fill(0.25);
    const output = resamplePodcastPcm(source, 48_000);
    expect(output).toHaveLength(16_000);
    expect(output[500]).toBeCloseTo(0.25);
  });

  it("does not copy already-16 kHz audio", () => {
    const source = new Float32Array([0, 0.5]);
    expect(resamplePodcastPcm(source, 16_000)).toBe(source);
  });

  it("aligns stream-local word timestamps after seeking and at different speeds", () => {
    expect(toPodcastWords([{ word: "hello", start: 0.5, end: 1 }], 42, 1.5))
      .toEqual([{ word: "hello", start: 42.75, end: 43.5 }]);
  });
});
