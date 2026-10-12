import { expect, it } from "vitest";
import { resolvePodcast } from "./podcasts";
import { downloadPodcastAudio } from "./podcastAudio";
import { preparePodcastAudio } from "./podcastAudioPreparation";

// Opt-in public media smoke test only. Never invokes Gemini or writes Firestore.
it.skipIf(process.env.RUN_PODCAST_AUDIO_SMOKE !== "1")("acquires the requested Lingokids Apple episode through the production safety path", async () => {
  const signal = AbortSignal.timeout(130_000);
  const episode = await resolvePodcast("https://podcasts.apple.com/tw/podcast/storytime-sweeter-than-honey/id1567336024?i=1000539350317", signal);
  if ("episodes" in episode) throw new Error("Expected single episode");
  expect(episode.episodeId).toBe("1000539350317");
  const audio = await downloadPodcastAudio(episode.audioUrl, signal);
  expect(audio.bytes.length).toBeGreaterThan(1000); expect(audio.duration).toBeGreaterThan(10);
  const prepared = await preparePodcastAudio(audio, signal);
  expect(prepared.bytes.length).toBeLessThanOrEqual(4 * 1024 * 1024);
  expect(prepared.duration).toBe(audio.duration);
  console.info(JSON.stringify({ title: episode.title, originalBytes: audio.bytes.length, preparedBytes: prepared.bytes.length, duration: audio.duration }));
}, 140_000);
