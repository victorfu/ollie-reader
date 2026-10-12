import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

it("uses the local Podcast server even when the general API targets a legacy cloud service", async () => {
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_API_BASE_URL", "https://legacy.example");
  vi.stubEnv("VITE_PODCAST_API_BASE_URL", "");
  vi.resetModules();
  const { PODCAST_API_BASE_URL } = await import("../constants/api");
  expect(PODCAST_API_BASE_URL).toBe("http://localhost:3000");
});
it("supports an explicit Podcast backend override", async () => {
  vi.stubEnv("VITE_PODCAST_API_BASE_URL", " https://podcast.example/ ");
  vi.resetModules();
  const { PODCAST_API_BASE_URL } = await import("../constants/api");
  expect(PODCAST_API_BASE_URL).toBe("https://podcast.example");
});
it("keeps the configured production API when no Podcast override is set", async () => {
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example");
  vi.stubEnv("VITE_PODCAST_API_BASE_URL", "");
  vi.resetModules();
  const { PODCAST_API_BASE_URL } = await import("../constants/api");
  expect(PODCAST_API_BASE_URL).toBe("https://api.example");
});
it.each([
  new Response(JSON.stringify({ detail: "Not Found" }), { status: 404 }),
  new Response("<html>Not found</html>", { status: 404 }),
])("explains a missing endpoint instead of showing raw Not Found or JSON errors", async (response) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const { resolvePodcast } = await import("./podcastService");
  await expect(resolvePodcast("https://podcasts.apple.com/tw/podcast/id1?i=2", new AbortController().signal)).rejects.toThrow("Podcast 服務尚未啟用");
});
it("preserves a genuine episode-not-found error from the resolver", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "RSS 中找不到指定單集" }), { status: 404 })));
  const { resolvePodcast } = await import("./podcastService");
  await expect(resolvePodcast("url", new AbortController().signal)).rejects.toThrow("RSS 中找不到指定單集");
});
it("rejects a successful HTML fallback instead of treating it as an episode", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>SPA fallback</html>")));
  const { resolvePodcast } = await import("./podcastService");
  await expect(resolvePodcast("url", new AbortController().signal)).rejects.toThrow("回應格式不正確");
});
