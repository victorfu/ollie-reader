import { fetch as publicFetch } from "undici";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ApiError, readLimited } from "./api";
import { parseTarget, publicAgent } from "./fetchUrl";
import { signPodcastAudio } from "./podcastAudio";

const MAX_METADATA_BYTES = 2 * 1024 * 1024;
const MAX_RSS_BYTES = 4 * 1024 * 1024;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const string = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export function parseApplePodcastUrl(input: unknown) {
  if (typeof input !== "string" || input.length > 2048) throw new ApiError("請貼上 Apple Podcasts 節目或單集網址", 400);
  let url: URL;
  try { url = new URL(input); } catch { throw new ApiError("無效的 Apple Podcasts 網址", 400); }
  const match = url.pathname.match(/^\/([a-z]{2})\/podcast\/(?:[^/]+\/)?id([1-9]\d*)\/?$/);
  const episodeId = url.searchParams.get("i");
  if (url.protocol !== "https:" || url.hostname !== "podcasts.apple.com" || url.port || url.username || url.password || !match || (episodeId !== null && !/^[1-9]\d*$/.test(episodeId)) || url.searchParams.getAll("i").length > 1) {
    throw new ApiError("請使用有效的 HTTPS Apple Podcasts 節目或單集網址", 400);
  }
  url.search = episodeId === null ? "" : new URLSearchParams({ i: episodeId }).toString();
  url.hash = "";
  return { sourceUrl: url.href, podcastId: match[2], episodeId };
}

export function parseAppleEpisodeUrl(input: unknown) {
  const ids = parseApplePodcastUrl(input);
  if (ids.episodeId === null) throw new ApiError("請使用包含 ?i=單集編號 的 Apple Podcasts 單集網址", 400);
  return { ...ids, episodeId: ids.episodeId };
}

type AppleShow = ReturnType<typeof parseApplePodcastUrl> & { feedUrl: string; podcastTitle: string };

function appleObjects(html: string): RecordValue[] {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const script = scripts.find(([, attributes]) => /\bid\s*=\s*(?:"serialized-server-data"|'serialized-server-data'|serialized-server-data(?=\s|$))/i.test(attributes));
  if (!script) throw new ApiError("Apple 未提供可識別此 Podcast 的資料", 422);
  let data: unknown;
  try { data = JSON.parse(script[2]); } catch { throw new ApiError("Apple Podcast 資料格式無法解析", 502); }
  const result: RecordValue[] = [];
  const queue: unknown[] = [data];
  while (queue.length) {
    const node = queue.pop();
    if (!node || typeof node !== "object") continue;
    result.push(record(node));
    queue.push(...Object.values(node));
  }
  return result;
}

export function parseAppleShowMetadata(html: string, ids: ReturnType<typeof parseApplePodcastUrl>): AppleShow {
  const candidates = appleObjects(html)
    .filter((show) => String(show.adamId) === ids.podcastId && string(show.feedUrl) && string(show.title))
    .map((show) => ({ ...ids, feedUrl: string(show.feedUrl), podcastTitle: string(show.title) }));
  const unique = new Map(candidates.map((show) => [JSON.stringify(show), show]));
  if (unique.size !== 1) throw new ApiError("無法唯一確認 Apple 指定節目的 RSS 資料", 422);
  return [...unique.values()][0];
}

export type AppleEpisode = ReturnType<typeof parseAppleEpisodeUrl> & {
  guid: string;
  feedUrl: string;
  title: string;
  podcastTitle: string;
};

// Apple numeric IDs and RSS GUIDs are different identifiers. Accept only an
// offer explicitly bound to BOTH requested IDs; never infer identity from title.
export function parseAppleMetadata(html: string, ids: ReturnType<typeof parseAppleEpisodeUrl>): AppleEpisode {
  const candidates: AppleEpisode[] = [];
  for (const value of appleObjects(html)) {
    const show = record(value.showOffer);
    if (String(value.contentId) === ids.episodeId && String(show.adamId) === ids.podcastId && string(value.guid) && string(show.feedUrl) && string(value.title) && string(show.title)) {
      candidates.push({ ...ids, guid: string(value.guid), feedUrl: string(show.feedUrl), title: string(value.title), podcastTitle: string(show.title) });
    }
  }
  const unique = new Map(candidates.map((candidate) => [JSON.stringify(candidate), candidate]));
  if (unique.size !== 1) throw new ApiError("無法唯一確認 Apple 指定單集，請確認連結或稍後重試", 422);
  return [...unique.values()][0];
}

export function parseDuration(value: unknown): number | null {
  const text = string(value);
  if (!/^\d+(?::[0-5]\d){0,2}$/.test(text)) return null;
  const seconds = text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function mediaUrl(value: unknown): string {
  const url = parseTarget(string(value));
  if (url.protocol !== "https:" || url.port) throw new ApiError("音訊與圖片來源必須使用公開 HTTPS 網址", 422);
  return url.href;
}

function parseRss(xml: string) {
  // Do not expand external/custom entities. Treat all feed content as data.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ApiError("Podcast RSS 格式無效", 502);
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, trimValues: true }).parse(xml);
  const channel = record(record(parsed.rss).channel);
  const items: unknown[] = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  return { channel, items: items.map(record) };
}

function rssGuid(item: RecordValue): string {
  return string(typeof item.guid === "string" ? item.guid : record(item.guid)["#text"]);
}

export function matchRssEpisode(xml: string, metadata: AppleEpisode) {
  const { channel, items } = parseRss(xml);
  const matches = items.filter((item) => rssGuid(item) === metadata.guid);
  if (!matches.length) throw new ApiError("RSS 中找不到指定單集，可能已下架或不在目前的 Feed 中", 404);
  if (matches.length !== 1) throw new ApiError("RSS 有多筆相同單集識別，無法安全選擇音訊", 422);
  return rssEpisode(matches[0], channel, metadata);
}

function rssEpisode(item: RecordValue, channel: RecordValue, metadata: AppleShow & { title: string; guid: string }) {
  const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
  const enclosure = enclosures.map(record).find((entry) => {
    const type = string(entry["@_type"]).toLowerCase().split(";")[0];
    return ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/webm"].includes(type) || (!type && /\.(mp3|m4a|aac|ogg|wav|webm)(?:\?|$)/i.test(string(entry["@_url"])));
  });
  if (!enclosure) throw new ApiError("此單集沒有可支援的音訊 enclosure", 422);
  const artwork = record(item["itunes:image"])["@_href"] ?? record(channel["itunes:image"])["@_href"];
  let artworkUrl: string | null = null;
  if (artwork) { try { artworkUrl = mediaUrl(artwork); } catch { /* Optional artwork can be omitted. */ } }
  const audioUrl = mediaUrl(enclosure["@_url"]);
  return {
    title: string(item.title) || metadata.title,
    podcastTitle: metadata.podcastTitle,
    artworkUrl,
    audioUrl,
    captionAudioUrl: signPodcastAudio(audioUrl),
    durationSeconds: parseDuration(item["itunes:duration"]),
    sourceUrl: metadata.sourceUrl,
    podcastId: metadata.podcastId,
    episodeId: metadata.episodeId,
    guid: metadata.guid,
  };
}

export function listRssEpisodes(xml: string, metadata: AppleShow) {
  const { channel, items } = parseRss(xml);
  const counts = new Map<string, number>();
  for (const item of items) counts.set(rssGuid(item), (counts.get(rssGuid(item)) ?? 0) + 1);
  const episodes = [];
  for (const item of items) {
    const guid = rssGuid(item);
    if (!guid || counts.get(guid) !== 1 || !string(item.title)) continue;
    try {
      episodes.push(rssEpisode(item, channel, { ...metadata, episodeId: null, title: string(item.title), guid }));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      // A bad/unsupported entry must not hide the other public episodes.
    }
  }
  if (!episodes.length) throw new ApiError("這個節目的 RSS 沒有可播放的公開單集", 422);
  return { kind: "show" as const, podcastTitle: metadata.podcastTitle, sourceUrl: metadata.sourceUrl, episodes, unavailableCount: items.length - episodes.length };
}

export async function resolvePodcast(input: unknown, requestSignal: AbortSignal) {
  const ids = parseApplePodcastUrl(input);
  const agent = publicAgent();
  const deadline = AbortSignal.timeout(20_000);
  const signal = AbortSignal.any([requestSignal, deadline]);
  async function fetchText(inputUrl: string, limit: number, appleOnly = false) {
    let url = parseTarget(inputUrl);
    for (let redirects = 0; ; redirects++) {
      if (url.protocol !== "https:" || url.port || (appleOnly && url.hostname !== "podcasts.apple.com")) throw new ApiError("不允許的 Podcast 來源或重新導向", 422);
      const response = await publicFetch(url, { dispatcher: agent, signal, redirect: "manual", headers: { Accept: appleOnly ? "text/html" : "application/rss+xml, application/xml, text/xml" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || redirects >= 3) throw new ApiError("Podcast 來源重新導向過多或無效", 502);
        url = parseTarget(new URL(location, url).href);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiError(`Podcast 來源暫時無法取得（HTTP ${response.status}）`, 502);
      }
      return new TextDecoder().decode(await readLimited(response as unknown as Response, limit));
    }
  }
  try {
    const html = await fetchText(ids.sourceUrl, MAX_METADATA_BYTES, true);
    if (ids.episodeId === null) {
      const metadata = parseAppleShowMetadata(html, ids);
      return listRssEpisodes(await fetchText(metadata.feedUrl, MAX_RSS_BYTES), metadata);
    }
    const metadata = parseAppleMetadata(html, { ...ids, episodeId: ids.episodeId });
    return matchRssEpisode(await fetchText(metadata.feedUrl, MAX_RSS_BYTES), metadata);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (deadline.aborted || (error instanceof Error && error.name === "TimeoutError")) throw new ApiError("Podcast 來源回應逾時，請稍後重試", 504);
    throw new ApiError("無法連線或解析 Podcast 來源，請稍後重試", 502);
  } finally {
    await agent.destroy();
  }
}
