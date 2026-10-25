import { createHmac, timingSafeEqual } from "node:crypto";
import { fetch as undiciFetch } from "undici";
import { ApiError } from "./api";
import { parseTarget, publicAgent } from "./fetchUrl";

// Each response covers at most one bounded slice; media elements request the
// next range themselves, so no invocation streams a whole episode.
export const MAX_SLICE_BYTES = 4 * 1024 * 1024;
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
const MAX_REDIRECTS = 8;
const AUDIO_TYPES = /^(audio\/[\w.+-]+|application\/octet-stream|binary\/octet-stream|video\/mp4)$/;
const REDIRECTS = [301, 302, 303, 307, 308];

function secret(): string | null {
  const value = process.env.PODCAST_AUDIO_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function signature(key: string, url: string, expires: number): string {
  return createHmac("sha256", key).update(`${expires}\n${url}`).digest("base64url");
}

/**
 * A same-origin-capable path for an RSS enclosure that the resolver already
 * verified. Returns null when the proxy is not configured, so captions fall
 * back to CORS-enabled hosts only.
 */
export function signPodcastAudio(url: string, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const expires = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
  const params = new URLSearchParams({ url, expires: String(expires), signature: signature(key, url, expires) });
  return `/api/podcasts/audio?${params}`;
}

export function verifyPodcastAudio(params: URLSearchParams, now = Date.now()): URL {
  const key = secret();
  if (!key) throw new ApiError("Podcast 音訊代理尚未設定", 503);
  const url = params.get("url") ?? "";
  const expires = Number(params.get("expires"));
  const given = Buffer.from(params.get("signature") ?? "");
  const expected = Buffer.from(signature(key, url, expires));
  if (!Number.isSafeInteger(expires) || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new ApiError("無效的 Podcast 音訊連結", 403);
  }
  if (expires * 1000 < now) throw new ApiError("Podcast 音訊連結已過期，請重新載入單集", 403);
  return parseTarget(url);
}

/** Parse a single `bytes=` range and clamp it to one bounded slice. */
export function sliceRange(header: string | null): { start: number; end: number } {
  if (!header) return { start: 0, end: MAX_SLICE_BYTES - 1 };
  const match = header.trim().match(/^bytes=(\d+)-(\d*)$/);
  if (!match) throw new ApiError("不支援的音訊範圍請求", 416);
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : Infinity;
  if (!Number.isSafeInteger(start) || requestedEnd < start) throw new ApiError("不支援的音訊範圍請求", 416);
  return { start, end: Math.min(requestedEnd, start + MAX_SLICE_BYTES - 1) };
}

export async function proxyPodcastAudio(request: Request, headers: Headers): Promise<Response> {
  let url = verifyPodcastAudio(new URL(request.url).searchParams);
  const range = sliceRange(request.headers.get("range"));
  const agent = publicAgent();
  const deadline = AbortSignal.timeout(60_000);
  const signal = AbortSignal.any([request.signal, deadline]);
  let streaming = false;
  try {
    for (let redirects = 0; ; redirects++) {
      const upstream = await undiciFetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal,
        headers: { Range: `bytes=${range.start}-${range.end}`, Accept: "audio/*, */*;q=0.5" },
      });
      if (REDIRECTS.includes(upstream.status)) {
        await upstream.body?.cancel();
        const location = upstream.headers.get("location");
        if (!location || redirects >= MAX_REDIRECTS) throw new ApiError("Podcast 音訊來源重新導向過多或無效", 502);
        url = parseTarget(new URL(location, url).href);
        continue;
      }
      if (upstream.status === 416) {
        await upstream.body?.cancel();
        headers.set("Content-Range", upstream.headers.get("content-range") ?? "bytes */*");
        return new Response(null, { status: 416, headers });
      }
      const type = (upstream.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim().toLowerCase();
      const encoded = (upstream.headers.get("content-encoding") ?? "identity").toLowerCase() !== "identity";
      // Only a byte-exact 206 slice can be passed through, and only real audio.
      const contentRange = upstream.headers.get("content-range") ?? "";
      const parsed = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/);
      if (upstream.status !== 206 || !parsed || Number(parsed[1]) !== range.start || Number(parsed[2]) > range.end || encoded || !AUDIO_TYPES.test(type)) {
        await upstream.body?.cancel();
        throw new ApiError(upstream.status >= 400 ? `Podcast 音訊來源暫時無法取得（HTTP ${upstream.status}）` : "Podcast 音訊來源不支援分段讀取", 502);
      }
      const length = Number(parsed[2]) - Number(parsed[1]) + 1;
      headers.set("Content-Type", type);
      headers.set("Content-Range", contentRange);
      headers.set("Content-Length", String(length));
      headers.set("Accept-Ranges", "bytes");
      headers.set("X-Content-Type-Options", "nosniff");
      if (!upstream.body) return new Response(null, { status: 206, headers });
      streaming = true;
      return new Response(exactBody(upstream.body as unknown as ReadableStream<Uint8Array>, length, () => agent.destroy()), { status: 206, headers });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (deadline.aborted) throw new ApiError("Podcast 音訊來源回應逾時", 504);
    throw new ApiError("無法連線 Podcast 音訊來源", 502);
  } finally {
    if (!streaming) await agent.destroy();
  }
}

// The declared Content-Length is already sent; never forward more than it.
function exactBody(source: ReadableStream<Uint8Array>, length: number, onClose: () => Promise<void>): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let size = 0;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    onClose().catch(() => {});
  };
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          close();
          return;
        }
        size += value.byteLength;
        if (size > length) throw new ApiError("Podcast 音訊來源回應長度不符", 502);
        controller.enqueue(value);
      } catch (error) {
        await reader.cancel().catch(() => {});
        controller.error(error);
        close();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => {});
      close();
    },
  });
}
