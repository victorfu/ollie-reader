import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), parse: vi.fn() }));
vi.mock("undici", async (original) => ({ ...await original<typeof import("undici")>(), fetch: mocks.fetch }));
vi.mock("music-metadata", () => ({ parseBuffer: mocks.parse }));
import { downloadPodcastAudio, MAX_AUDIO_BYTES } from "./podcastAudio";
const run = (url = "https://audio.example/episode.mp3") => downloadPodcastAudio(url, new AbortController().signal);
const response = (headers = {}) => new Response("audio", { headers: { "content-type": "audio/mpeg", ...headers } });
afterEach(() => vi.resetAllMocks());
it.each(["audio/webm", "audio/webm; codecs=opus", "Audio/WebM"])("accepts WebM enclosure content type %s", async (mimeType) => {
  mocks.fetch.mockResolvedValue(response({ "content-type": mimeType }));
  mocks.parse.mockResolvedValue({ format: { duration: 80 } });
  expect(await run("https://audio.example/episode.webm")).toMatchObject({ mimeType: "audio/webm", duration: 80 });
  expect(mocks.parse).toHaveBeenCalledWith(expect.any(Uint8Array), { mimeType: "audio/webm", size: 5 }, { duration: true, skipCovers: true });
});
it("downloads with the public DNS dispatcher and verifies real duration", async () => {
  mocks.fetch.mockResolvedValue(response()); mocks.parse.mockResolvedValue({ format: { duration: 80 } });
  expect(await run()).toMatchObject({ mimeType: "audio/mpeg", duration: 80 });
  expect(mocks.fetch.mock.calls[0][1]).toMatchObject({ redirect: "manual", dispatcher: expect.anything(), signal: expect.any(AbortSignal) });
});
it.each(["https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a", "https://169.254.169.254/a", "http://audio.example/a", "https://audio.example:8080/a"]) ("rejects unsafe source %s", async (url) => {
  await expect(run(url)).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled();
});
it("validates every redirect before connecting", async () => {
  mocks.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/internal" } }));
  await expect(run()).rejects.toThrow(); expect(mocks.fetch).toHaveBeenCalledOnce();
});
it("limits redirects", async () => {
  mocks.fetch.mockImplementation(() => new Response(null, { status: 302, headers: { location: "https://audio.example/next" } }));
  await expect(run()).rejects.toMatchObject({ status: 502 }); expect(mocks.fetch).toHaveBeenCalledTimes(6);
});
it("rejects oversized media before reading", async () => {
  mocks.fetch.mockResolvedValue(response({ "content-length": String(MAX_AUDIO_BYTES + 1) }));
  await expect(run()).rejects.toMatchObject({ status: 413 }); expect(mocks.parse).not.toHaveBeenCalled();
});
it("bounds chunked audio even without a content-length header", async () => {
  mocks.fetch.mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_AUDIO_BYTES + 1)); controller.close(); } }), { headers: { "content-type": "audio/mpeg" } }));
  await expect(run()).rejects.toMatchObject({ status: 413 });
});
it("rejects unsupported MIME and disguised invalid audio", async () => {
  mocks.fetch.mockResolvedValueOnce(response({ "content-type": "text/html" }));
  await expect(run()).rejects.toMatchObject({ status: 415 });
  mocks.fetch.mockResolvedValueOnce(response()); mocks.parse.mockRejectedValue(new Error("not audio"));
  await expect(run()).rejects.toMatchObject({ status: 415 });
});
it.each([undefined, 0, Infinity, 1801])("rejects unverified or excessive duration %s", async (duration) => {
  mocks.fetch.mockResolvedValue(response()); mocks.parse.mockResolvedValue({ format: { duration } });
  await expect(run()).rejects.toThrow();
});
it("reports upstream failures without exposing URLs", async () => {
  mocks.fetch.mockRejectedValue(new Error("private diagnostic")); await expect(run()).rejects.toMatchObject({ status: 502 });
});
