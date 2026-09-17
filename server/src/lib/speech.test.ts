import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EDGE_VOICE, escapeSpeechText, parseSpeechRequest, rateFromSpeed } from "./speech";

afterEach(() => vi.unstubAllEnvs());

describe("speech contract", () => {
  it("defaults to monolingual Aria and normal speed", () => {
    vi.stubEnv("EDGE_TTS_VOICE", "");
    expect(parseSpeechRequest({ text: "hello" })).toEqual({
      text: "hello", speed: 1, voice: DEFAULT_EDGE_VOICE,
    });
  });

  it("applies explicit voice, environment and default precedence", () => {
    vi.stubEnv("EDGE_TTS_VOICE", " en-GB-RyanNeural ");
    for (const voice of [undefined, null, "", "   "]) {
      expect(parseSpeechRequest({ text: "hi", voice }).voice).toBe("en-GB-RyanNeural");
    }
    expect(parseSpeechRequest({ text: "hi", voice: " en-US-AriaNeural " }).voice).toBe(DEFAULT_EDGE_VOICE);
    vi.stubEnv("EDGE_TTS_VOICE", " ");
    expect(parseSpeechRequest({ text: "hi" }).voice).toBe(DEFAULT_EDGE_VOICE);
  });

  it.each([
    null, [], "hello", {}, { text: " " }, { text: 1 },
    { text: "hi", speed: "1" }, { text: "hi", speed: null },
    { text: "hi", speed: NaN }, { text: "hi", speed: Infinity },
    { text: "hi", voice: 12 }, { text: "hi", voice: 'en-US-AriaNeural"' },
    { text: "hi\u0000" }, { text: "\ud800" },
  ])("rejects invalid input %j", (input) => {
    expect(() => parseSpeechRequest(input)).toThrow(expect.objectContaining({ status: 400 }));
  });

  it("counts Unicode characters and enforces the text limit", () => {
    expect(parseSpeechRequest({ text: "😀".repeat(5000) }).text).toHaveLength(10000);
    expect(() => parseSpeechRequest({ text: "x".repeat(5001) }))
      .toThrow(expect.objectContaining({ status: 413 }));
  });

  it("rejects an invalid configured voice as a server error", () => {
    vi.stubEnv("EDGE_TTS_VOICE", "not a voice");
    expect(() => parseSpeechRequest({ text: "hi" }))
      .toThrow(expect.objectContaining({ status: 500 }));
  });

  it.each([
    [1, "+0%"], [1.5, "+50%"], [0.75, "-25%"], [5, "+100%"],
    [0.01, "-50%"], [0, "+0%"], [-3, "+0%"], [1.125, "+12%"],
    [1.375, "+38%"], [0.875, "-12%"], [0.625, "-38%"],
  ])("matches Python speed conversion for %s", (speed, rate) => {
    expect(rateFromSpeed(speed)).toBe(rate);
  });

  it("escapes markup and entities as literal speech text", () => {
    expect(escapeSpeechText(`A & B <speak>"don't" &amp;`))
      .toBe("A &amp; B &lt;speak&gt;&quot;don&apos;t&quot; &amp;amp;");
  });
});
