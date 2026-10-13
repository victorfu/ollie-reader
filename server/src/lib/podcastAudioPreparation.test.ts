import { afterEach, expect, it, vi } from "vitest";
import { parseBuffer } from "music-metadata";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("undici", async (original) => ({ ...await original<typeof import("undici")>(), fetch: mocks.fetch }));
import { downloadPodcastAudio } from "./podcastAudio";
import { preparePodcastAudio, MAX_PREPARED_BYTES } from "./podcastAudioPreparation";

afterEach(() => vi.resetAllMocks());

function wav(seconds: number) {
  const samples = seconds * 16000;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}
it("prepares full-length WebM with the bundled FFmpeg, under the HTTP/Firebase limits", async () => {
  const result = await preparePodcastAudio({ bytes: wav(2), duration: 2 }, new AbortController().signal);
  expect(result.duration).toBe(2); expect(result.bytes.length).toBeGreaterThan(100);
  expect(result.bytes.length).toBeLessThan(MAX_PREPARED_BYTES);
}, 15000);
it("downloads a real WebM enclosure and converts it without losing duration", async () => {
  const signal = new AbortController().signal;
  const source = await preparePodcastAudio({ bytes: wav(2), duration: 2 }, signal);
  mocks.fetch.mockResolvedValue(new Response(source.bytes, { headers: { "content-type": "audio/webm; codecs=opus" } }));
  const downloaded = await downloadPodcastAudio("https://audio.example/episode.webm", signal);
  expect(downloaded.mimeType).toBe("audio/webm");
  const result = await preparePodcastAudio(downloaded, signal);
  const metadata = await parseBuffer(result.bytes, { mimeType: "audio/webm", size: result.bytes.length }, { duration: true });
  expect(metadata.format.duration).toBeCloseTo(downloaded.duration, 1);
  expect(result.bytes.length).toBeGreaterThan(100);
  expect(result.bytes.length).toBeLessThan(MAX_PREPARED_BYTES);
}, 15000);
it("rejects a mismatched/truncated duration", async () => {
  await expect(preparePodcastAudio({ bytes: wav(1), duration: 10 }, new AbortController().signal)).rejects.toMatchObject({ status: 422 });
}, 15000);
it("honors cancellation before doing work", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(preparePodcastAudio({ bytes: wav(1), duration: 1 }, controller.signal)).rejects.toThrow();
});
