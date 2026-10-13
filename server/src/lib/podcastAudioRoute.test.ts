import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ verify: vi.fn(), resolve: vi.fn(), download: vi.fn(), prepare: vi.fn() }));
vi.mock("./firebaseAuth", () => ({ verifyFirebaseToken: m.verify }));
vi.mock("./podcasts", async (original) => ({ ...await original<typeof import("./podcasts")>(), resolvePodcast: m.resolve }));
vi.mock("./podcastAudio", () => ({ downloadPodcastAudio: m.download }));
vi.mock("./podcastAudioPreparation", () => ({ preparePodcastAudio: m.prepare }));
import { POST, OPTIONS } from "../app/api/podcasts/audio/route";
import { ApiError } from "./api";
let sequence = 0;
const episode = { podcastId: "1", episodeId: "2", guid: "guid", audioUrl: "https://trusted.example/audio.mp3" };
const request = (body: object = {}) => new Request("http://localhost/api/podcasts/audio", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer firebase-token", origin: "http://localhost:5173" }, body: JSON.stringify({ sourceUrl: "https://podcasts.apple.com/us/podcast/id1?i=2", guid: "guid", ...body }) });
beforeEach(() => {
  vi.stubEnv("FIREBASE_PROJECT_ID", "test-project"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("allowed")));
  m.verify.mockResolvedValue({ uid: `user-${sequence++}`, email: "user@example.com", email_verified: true });
  m.resolve.mockResolvedValue(episode); m.download.mockResolvedValue({ bytes: new Uint8Array([1]), duration: 60 });
  m.prepare.mockResolvedValue({ bytes: new Uint8Array([1, 2]), duration: 60 });
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("requires authentication and allowlist authorization before fetching media", async () => {
  m.verify.mockRejectedValueOnce(new ApiError("missing", 401)); expect((await POST(request())).status).toBe(401);
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 403 })); expect((await POST(request())).status).toBe(403);
  expect(m.download).not.toHaveBeenCalled();
});
it("checks allowlist with the user's token, returns small WebM and ignores client audio URLs", async () => {
  const response = await POST(request({ audioUrl: "https://localhost/secret" }));
  expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("audio/webm");
  expect(response.headers.get("X-Audio-Duration")).toBe("60"); expect(response.headers.get("access-control-expose-headers")).toContain("X-Audio-Duration");
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("allowedUsers/user%40example.com"), expect.objectContaining({ headers: expect.any(Headers) }));
  expect((vi.mocked(fetch).mock.calls[0][1]!.headers as Headers).get("Authorization")).toBe("Bearer firebase-token");
  expect(m.download).toHaveBeenCalledWith(episode.audioUrl, expect.any(AbortSignal));
});
it("rejects invalid source URLs and mismatched GUIDs", async () => {
  expect((await POST(request({ sourceUrl: "https://127.0.0.1" }))).status).toBe(400);
  m.resolve.mockResolvedValue({ ...episode, guid: "other" }); expect((await POST(request())).status).toBe(422);
  expect(m.download).not.toHaveBeenCalled();
});
it("prevents duplicate preparation and preserves conversion failures", async () => {
  m.prepare.mockRejectedValueOnce(new ApiError("conversion failed", 502));
  expect((await POST(request())).status).toBe(502);
  expect((await POST(request())).status).toBe(429);
  expect(m.prepare).toHaveBeenCalledOnce();
});
it("supports authorized JSON preflight", async () => {
  const response = await OPTIONS(new Request("http://localhost", { method: "OPTIONS", headers: { origin: "http://localhost:5173", "access-control-request-method": "POST", "access-control-request-headers": "authorization, content-type" } }));
  expect(response.status).toBe(204); expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
});
