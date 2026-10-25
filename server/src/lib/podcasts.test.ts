import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), verify: vi.fn() }));
vi.mock("./firebaseAuth", () => ({ verifyFirebaseToken: mocks.verify }));
vi.mock("undici", async (original) => ({ ...await original<typeof import("undici")>(), fetch: mocks.fetch }));
import { matchRssEpisode, parseAppleEpisodeUrl, parseAppleMetadata, parseDuration } from "./podcasts";
import { POST, OPTIONS } from "../app/api/podcasts/resolve/route";
import { ApiError } from "./api";

const url = "https://podcasts.apple.com/tw/podcast/storytime-sweeter-than-honey/id1567336024?i=1000539350317";
const ids = parseAppleEpisodeUrl(url);
const offer = { contentId: ids.episodeId, title: "Test episode", guid: "rss-guid-not-apple-id", showOffer: { adamId: ids.podcastId, title: "Test show", feedUrl: "https://feed.example/podcast.rss" } };
const html = (value: unknown = offer) => `<script type="application/json" id="serialized-server-data">${JSON.stringify({ data: value })}</script>`;
const metadata = parseAppleMetadata(html(), ids);
const item = (guid = offer.guid, enclosure = '<enclosure url="https://audio.example/story.m4a" type="audio/mp4"/>') => `<item><title>Test episode</title><guid isPermaLink="false">${guid}</guid><itunes:duration>6:22</itunes:duration>${enclosure}</item>`;
const rss = (items = item()) => `<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>${items}</channel></rss>`;
const request = (body: unknown = { url }) => new Request("http://localhost/api/podcasts/resolve", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:5173" }, body: JSON.stringify(body) });
afterEach(() => vi.resetAllMocks());

describe("Apple episode identification", () => {
  it("extracts both IDs and strips unrelated parameters", () => {
    expect(parseAppleEpisodeUrl(`${url}&uo=4#fragment`)).toEqual(ids);
    expect(parseAppleEpisodeUrl("https://podcasts.apple.com/us/podcast/id123?i=456").episodeId).toBe("456");
  });
  it.each(["no url", "http://podcasts.apple.com/tw/podcast/id123?i=456", "https://podcasts.apple.com.evil.test/tw/podcast/id123?i=456", "https://user:pass@podcasts.apple.com/tw/podcast/id123?i=456", "https://podcasts.apple.com:8443/tw/podcast/id123?i=456", "https://podcasts.apple.com/tw/podcast/id123", "https://podcasts.apple.com/tw/podcast/id123?i=456&i=789", "https://127.0.0.1/tw/podcast/id123?i=456", "https://podcasts.apple.com/tw/podcast/id123?i=abc", null])("rejects invalid input %s", (input) => expect(() => parseAppleEpisodeUrl(input)).toThrow());
  it("binds a GUID to the exact episode and show, deduplicating repeated offers", () => {
    expect(parseAppleMetadata(html([offer, offer, { ...offer, contentId: "other", guid: "other" }]), ids).guid).toBe(offer.guid);
    expect(() => parseAppleMetadata(html({ ...offer, showOffer: { ...offer.showOffer, adamId: "999" } }), ids)).toThrow("無法唯一");
    expect(() => parseAppleMetadata(html([offer, { ...offer, guid: "conflict" }]), ids)).toThrow("無法唯一");
    expect(() => parseAppleMetadata("<html/>", ids)).toThrow();
    expect(() => parseAppleMetadata('<script id="serialized-server-data">oops</script>', ids)).toThrow();
  });
  it("matches the RSS GUID, supports M4A and parses duration", () => {
    expect(matchRssEpisode(rss(), metadata)).toMatchObject({ audioUrl: "https://audio.example/story.m4a", title: "Test episode", durationSeconds: 382, guid: offer.guid });
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("invalid")).toBeNull();
  });
  it("never falls back to same title or the first/newest item", () => {
    expect(() => matchRssEpisode(rss(item(ids.episodeId)), metadata)).toThrow("找不到");
    expect(() => matchRssEpisode(rss(item("other") + item("another")), metadata)).toThrow("找不到");
    expect(() => matchRssEpisode(rss(item() + item()), metadata)).toThrow("多筆");
  });
  it("rejects unsafe or unsupported enclosures and XML entities", () => {
    expect(() => matchRssEpisode(rss(item(offer.guid, '<enclosure url="https://127.0.0.1/a.mp3" type="audio/mpeg"/>')), metadata)).toThrow();
    expect(() => matchRssEpisode(rss(item(offer.guid, '<enclosure url="https://audio.example/a" type="text/html"/>')), metadata)).toThrow("enclosure");
    expect(() => matchRssEpisode('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + rss(), metadata)).toThrow("RSS 格式");
  });
});

describe("Podcast resolver API", () => {
  it("resolves through Apple page and RSS without fetching audio", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(html())).mockResolvedValueOnce(new Response(rss()));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ episodeId: ids.episodeId, guid: offer.guid });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
  it.each([0, 1])("reports a timeout in upstream stage %s", async (stage) => {
    if (stage) mocks.fetch.mockResolvedValueOnce(new Response(html()));
    mocks.fetch.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect((await POST(request())).status).toBe(504);
  });
  it.each([0, 1])("reports a network failure in upstream stage %s", async (stage) => {
    if (stage) mocks.fetch.mockResolvedValueOnce(new Response(html()));
    mocks.fetch.mockRejectedValueOnce(new TypeError("connection failed"));
    expect((await POST(request())).status).toBe(502);
  });
  it("bounds metadata and RSS response bodies", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("x".repeat(2 * 1024 * 1024 + 1)));
    expect((await POST(request())).status).toBe(413);
    mocks.fetch.mockResolvedValueOnce(new Response(html())).mockResolvedValueOnce(new Response("x".repeat(4 * 1024 * 1024 + 1)));
    expect((await POST(request())).status).toBe(413);
  });
  it.each(["https://127.0.0.1/a", "https://[::1]/a", "http://feed.example/a", "https://podcasts.apple.com.evil.test/a"]) ("rejects unsafe Apple redirects: %s", async (location) => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location } }));
    expect((await POST(request())).status).not.toBe(200);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("revalidates RSS redirects and limits loops", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(html())).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://10.0.0.1/feed" } }));
    expect((await POST(request())).status).toBe(400);
    mocks.fetch.mockImplementation(async () => new Response(null, { status: 302, headers: { location: url } }));
    expect((await POST(request())).status).toBe(502);
  });
  it("rejects bad request bodies without upstream requests", async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ url: "x".repeat(5000) }))).status).toBe(413);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("supports JSON POST preflight", async () => {
    const response = await OPTIONS(new Request("http://localhost/api/podcasts/resolve", { method: "OPTIONS", headers: { origin: "http://localhost:5173", "access-control-request-method": "POST", "access-control-request-headers": "content-type, authorization" } }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
  });
  it("never fetches Apple or RSS when Firebase authentication fails", async () => {
    mocks.verify.mockRejectedValueOnce(new ApiError("Missing authorization header", 401));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("Show links", () => {
  it("returns a selectable feed list for a show link without fetching audio", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(html([offer.showOffer, { adamId: "999", feedUrl: "https://other.example/feed", title: "Unrelated show" }])))
      .mockResolvedValueOnce(new Response(rss(item() + item("another-guid"))));
    const response = await POST(request({ url: url.split("?")[0] }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.kind).toBe("show");
    expect(data.podcastTitle).toBe("Test show");
    expect(data.episodes).toHaveLength(2);
    expect(data.episodes[0]).toMatchObject({ guid: offer.guid, episodeId: null });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("omits ambiguous GUIDs and unplayable enclosures from a show", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(html(offer.showOffer)))
      .mockResolvedValueOnce(new Response(rss(item() + item() + item("good") + item("bad", '<enclosure url="https://127.0.0.1/a.mp3" type="audio/mpeg"/>'))));
    const response = await POST(request({ url: url.split("?")[0] }));
    const data = await response.json();
    expect(data.episodes.map((entry: { guid: string }) => entry.guid)).toEqual(["good"]);
    expect(data.unavailableCount).toBe(3);
  });
  it("rejects a show with conflicting feeds instead of using related-show metadata", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(html([offer.showOffer, { ...offer.showOffer, feedUrl: "https://other.example/rss" }])));
    expect((await POST(request({ url: url.split("?")[0] }))).status).toBe(422);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
