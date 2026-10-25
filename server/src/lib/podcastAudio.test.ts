import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("undici", async (importOriginal) => ({ ...await importOriginal<typeof import("undici")>(), fetch: mocks.fetch }));
import { MAX_SLICE_BYTES, signPodcastAudio, sliceRange, verifyPodcastAudio } from "./podcastAudio";
import { GET } from "../app/api/podcasts/audio/route";

const SECRET = "x".repeat(40);
const AUDIO = "https://audio.example/story.mp3";
const request = (path: string, range?: string) => new Request(`http://localhost${path}`, { headers: { Origin: "https://ollie-reader.web.app", ...(range ? { Range: range } : {}) } });
const audio = (start: number, end: number, total = 10_000_000, init: ResponseInit = {}) =>
  new Response(new Uint8Array(end - start + 1), { status: 206, ...init, headers: { "content-type": "audio/mpeg", "content-range": `bytes ${start}-${end}/${total}`, ...init.headers } });

beforeEach(() => vi.stubEnv("PODCAST_AUDIO_SECRET", SECRET));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("podcast audio signing", () => {
  it("is disabled without a strong secret", () => {
    vi.stubEnv("PODCAST_AUDIO_SECRET", "short");
    expect(signPodcastAudio(AUDIO)).toBeNull();
    expect(() => verifyPodcastAudio(new URLSearchParams({ url: AUDIO }))).toThrow(expect.objectContaining({ status: 503 }));
  });
  it("binds the exact URL and expiry", () => {
    const path = signPodcastAudio(AUDIO, 0)!;
    const params = new URL(path, "http://localhost").searchParams;
    expect(verifyPodcastAudio(params, 0).href).toBe(AUDIO);
    const tampered = new URLSearchParams(params); tampered.set("url", "https://evil.example/a.mp3");
    expect(() => verifyPodcastAudio(tampered, 0)).toThrow(expect.objectContaining({ status: 403 }));
    const extended = new URLSearchParams(params); extended.set("expires", String(Number(params.get("expires")) + 1));
    expect(() => verifyPodcastAudio(extended, 0)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => verifyPodcastAudio(params, 13 * 60 * 60 * 1000)).toThrow(/過期/);
  });
});

describe("range slicing", () => {
  it("clamps open and oversized ranges to one slice", () => {
    expect(sliceRange(null)).toEqual({ start: 0, end: MAX_SLICE_BYTES - 1 });
    expect(sliceRange("bytes=100-")).toEqual({ start: 100, end: 100 + MAX_SLICE_BYTES - 1 });
    expect(sliceRange("bytes=5-9")).toEqual({ start: 5, end: 9 });
  });
  it("rejects suffix, multi and malformed ranges", () => {
    for (const header of ["bytes=-500", "bytes=0-1,5-9", "items=0-1", "bytes=9-5"]) {
      expect(() => sliceRange(header)).toThrow(expect.objectContaining({ status: 416 }));
    }
  });
});

describe("GET /api/podcasts/audio", () => {
  it("refuses unsigned requests without contacting upstream", async () => {
    const response = await GET(request(`/api/podcasts/audio?url=${encodeURIComponent(AUDIO)}`));
    expect(response.status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("follows redirects and streams a bounded 206 slice with CORS", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://cdn.example/story.mp3" } }))
      .mockResolvedValueOnce(audio(100, 199));
    const response = await GET(request(signPodcastAudio(AUDIO)!, "bytes=100-199"));
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 100-199/10000000");
    expect(response.headers.get("content-length")).toBe("100");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://ollie-reader.web.app");
    expect((await response.arrayBuffer()).byteLength).toBe(100);
    expect(mocks.fetch.mock.calls[1][0].href).toBe("https://cdn.example/story.mp3");
    expect(mocks.fetch.mock.calls[1][1].headers.Range).toBe("bytes=100-199");
  });
  it("asks upstream for at most one slice of an open range", async () => {
    mocks.fetch.mockResolvedValueOnce(audio(0, 9));
    await GET(request(signPodcastAudio(AUDIO)!, "bytes=0-"));
    expect(mocks.fetch.mock.calls[0][1].headers.Range).toBe(`bytes=0-${MAX_SLICE_BYTES - 1}`);
  });
  it("refuses redirects to private addresses", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    expect((await GET(request(signPodcastAudio(AUDIO)!, "bytes=0-9"))).status).toBe(400);
  });
  it("refuses non-audio, unranged or encoded upstream responses", async () => {
    mocks.fetch.mockResolvedValueOnce(audio(0, 9, 100, { headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response("whole file", { headers: { "content-type": "audio/mpeg" } }))
      .mockResolvedValueOnce(audio(0, 9, 100, { headers: { "content-encoding": "gzip" } }));
    for (let i = 0; i < 3; i++) expect((await GET(request(signPodcastAudio(AUDIO)!, "bytes=0-9"))).status).toBe(502);
  });
  it("passes through an unsatisfiable range", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 416, headers: { "content-range": "bytes */100" } }));
    const response = await GET(request(signPodcastAudio(AUDIO)!, "bytes=500-"));
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */100");
  });
});
