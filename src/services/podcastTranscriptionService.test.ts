import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { PodcastEpisode } from "../types/podcast";
const m = vi.hoisted(() => ({ generate: vi.fn(), read: vi.fn(), claim: vi.fn(), save: vi.fn(), fail: vi.fn() }));
vi.mock("./geminiClient", () => ({ generateGeminiContent: m.generate }));
vi.mock("../utils/firebaseUtil", () => ({ appCheck: {} }));
vi.mock("firebase/app-check", () => ({ getToken: async () => ({ token: "appcheck-token" }) }));
vi.mock("./podcastTranscriptStorage", () => ({ transcriptId: async () => "id", readPodcastTranscript: m.read, claimPodcastTranscript: m.claim, savePodcastTranscript: m.save, failPodcastTranscript: m.fail }));
import { requestPodcastTranscript } from "./podcastTranscriptionService";
const user = { uid: "user", getIdToken: async () => "firebase-token" } as unknown as User;
const episode = { podcastId: "1", episodeId: "2", guid: "guid", title: "Story", sourceUrl: "https://podcasts.apple.com/us/podcast/id1", audioUrl: "do-not-send" } as PodcastEpisode;
const run = (action: "check" | "generate" = "generate") => requestPodcastTranscript(user, episode, action, new AbortController().signal);
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/webm", "X-Audio-Duration": "60" } })));
  m.claim.mockResolvedValue({ token: "lease" }); m.fail.mockResolvedValue(undefined);
  m.generate.mockResolvedValue({ response: { candidates: [{ finishReason: "STOP" }], text: () => '{"segments":[{"text":"Full speech.","start":1,"end":5}]}' } });
  m.save.mockImplementation(async (_uid, _id, _token, transcript) => transcript);
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });
it("checks existing Firestore without contacting the backend or model", async () => {
  m.read.mockResolvedValue({ status: "idle" }); expect(await run("check")).toEqual({ status: "idle" });
  expect(m.read).toHaveBeenCalledWith("user", "id"); expect(fetch).not.toHaveBeenCalled(); expect(m.generate).not.toHaveBeenCalled();
});
it.each(["completed", "generating"])("a %s claim never invokes Gemini or downloads media", async (status) => {
  m.claim.mockResolvedValue({ status }); expect(await run()).toMatchObject({ status });
  expect(fetch).not.toHaveBeenCalled(); expect(m.generate).not.toHaveBeenCalled();
});
it("uses Firebase multimodal input through the shared client and persists success", async () => {
  const result = await run(); expect(result).toMatchObject({ status: "completed", transcript: { fullText: "Full speech.", model: "gemini-3.5-flash-lite" } });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/podcasts/audio"), expect.objectContaining({ headers: { "Content-Type": "application/json", Authorization: "Bearer firebase-token", "X-Firebase-AppCheck": "appcheck-token" }, body: JSON.stringify({ sourceUrl: episode.sourceUrl, guid: "guid" }) }));
  expect(m.generate).toHaveBeenCalledWith(expect.objectContaining({ contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/webm", data: "AQID" } }, { text: expect.stringContaining("Do not summarize") }] }], generationConfig: expect.objectContaining({ responseMimeType: "application/json" }) }), { action: "podcast_transcript", retry: false, signal: expect.any(AbortSignal) });
  expect(m.save).toHaveBeenCalledWith("user", "id", "lease", expect.objectContaining({ fullText: "Full speech.", guid: "guid" }));
});
it.each(["MAX_TOKENS", "SAFETY", undefined])("rejects incomplete output %s without caching", async (finishReason) => {
  m.generate.mockResolvedValue({ response: { candidates: [{ finishReason }], text: () => '{"segments":[{"text":"Partial"}]}' } });
  await expect(run()).rejects.toThrow("未完整"); expect(m.save).not.toHaveBeenCalled(); expect(m.fail).toHaveBeenCalled();
});
it("preserves existing quota failures without retrying or saving", async () => {
  m.generate.mockRejectedValue(new Error("今天的 Gemini 免費額度已用完"));
  await expect(run()).rejects.toThrow("額度"); expect(m.generate).toHaveBeenCalledOnce(); expect(m.save).not.toHaveBeenCalled();
});
it("rejects malformed results", async () => {
  m.generate.mockResolvedValue({ response: { candidates: [{ finishReason: "STOP" }], text: () => "invalid json" } });
  await expect(run()).rejects.toThrow(); expect(m.save).not.toHaveBeenCalled();
});
it("rejects oversized audio before sending a model request", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array(4 * 1024 * 1024 + 1), { headers: { "content-type": "audio/webm", "X-Audio-Duration": "60" } }));
  await expect(run()).rejects.toThrow("輸入限制"); expect(m.generate).not.toHaveBeenCalled();
});
it("does not report completion when saving fails", async () => {
  m.save.mockRejectedValue(new Error("Firestore permission denied")); await expect(run()).rejects.toThrow("Firestore");
});
it("does not interpret a failed Firestore read as a cache miss", async () => {
  m.read.mockRejectedValue(new Error("permission denied")); await expect(run("check")).rejects.toThrow("permission"); expect(m.generate).not.toHaveBeenCalled();
});
