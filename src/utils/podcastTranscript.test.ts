import { describe, expect, it } from "vitest";
import { parseTranscript } from "./podcastTranscript";

const parse = (segments: unknown[]) => parseTranscript(JSON.stringify({ segments }), 100);
describe("Podcast transcript validation", () => {
  it("preserves complete text and validated ordered timings", () => {
    expect(parse([{ text: "Hello!", start: 1, end: 2 }, { text: "Goodbye.", start: 99, end: 101 }])).toMatchObject({
      fullText: "Hello!\n\nGoodbye.", timingAvailable: true,
      segments: [{ id: "segment-1", text: "Hello!", start: 1, end: 2 }, { start: 99, end: 101 }],
    });
  });
  it("supports plain transcripts", () => {
    expect(parse([{ text: " Hello. " }, { text: "The end.", start: null, end: null }])).toMatchObject({ timingAvailable: false, fullText: "Hello.\n\nThe end." });
  });
  it.each([
    { start: -1, end: 2 }, { start: 3, end: 2 }, { start: 2, end: 2 },
    { start: null, end: 5 }, { start: 2, end: null }, { start: 90, end: 103 },
    { start: Infinity, end: Infinity }, { start: NaN, end: 2 }, { start: "4", end: 5 },
  ])("retains text but removes all timing when invalid: %j", (timing) => {
    const result = parse([{ text: "First.", start: 0, end: 1 }, { text: "Last.", ...timing }]);
    expect(result.timingAvailable).toBe(false);
    expect(result.segments.every((s) => s.start === null && s.end === null)).toBe(true);
    expect(result.fullText).toBe("First.\n\nLast.");
  });
  it("rejects out of order / overlapping alignment without losing speech", () => {
    expect(parse([{ text: "First.", start: 10, end: 20 }, { text: "Second.", start: 5, end: 10 }]).timingAvailable).toBe(false);
    expect(parse([{ text: "First.", start: 10, end: 20 }, { text: "Second.", start: 19, end: 22 }]).timingAvailable).toBe(false);
  });
  it.each(["invalid json", "{}", '{"segments":[]}', '{"segments":[{}]}', '{"segments":[{"text":" "}]}', '{"segments":[{"text":123}]}'])("rejects malformed/empty results: %s", (raw) => {
    expect(() => parseTranscript(raw, 100)).toThrow();
  });
});
