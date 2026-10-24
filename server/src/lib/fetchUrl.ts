import { lookup } from "node:dns";
import { isIP } from "node:net";
import { basename, extname } from "node:path";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";
import { ApiError } from "./api";

// Streamed responses are exempt from Vercel's 4.5 MB body limit, so this only bounds the transfer.
export const MAX_BYTES = 50 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf", "text/html": ".html", "text/plain": ".txt",
  "application/json": ".json", "image/jpeg": ".jpg", "image/png": ".png",
  "image/gif": ".gif", "application/epub+zip": ".epub",
};

export function isPublicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}

export function parseTarget(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new ApiError("無效的 URL", 400); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new ApiError("URL 必須使用 HTTP(S) 且不得包含帳密", 400);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || (isIP(hostname) && !isPublicAddress(hostname))) throw new ApiError("只允許抓取公開網路資源", 400);
  return url;
}

// Validate the actual socket lookup, not a separate DNS preflight; redirects use
// the same dispatcher so DNS changes cannot bypass the public-address boundary.
export function publicAgent(): Agent {
  return new Agent({ connect: { lookup(hostname, options, callback) {
    lookup(hostname, { family: options.family, all: true }, (error, addresses) => {
      if (error) return callback(error, [], undefined);
      if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
        return callback(new Error("Non-public address"), [], undefined);
      }
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    });
  } } });
}

export function fetchOptions(params: URLSearchParams) {
  const url = params.get("url");
  if (!url) throw new ApiError("缺少 url", 422);
  const bool = (params.get("follow_redirects") ?? "true").toLowerCase();
  if (!["true", "false", "1", "0", "yes", "no", "on", "off", "t", "f", "y", "n"].includes(bool)) throw new ApiError("follow_redirects 必須是布林值", 422);
  const integer = (name: string, fallback: number, max: number) => {
    const raw = params.get(name) ?? String(fallback);
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) throw new ApiError(`${name} 必須介於 1 到 ${max}`, 422);
    return Number(raw);
  };
  return { url: parseTarget(url), follow: ["true", "1", "yes", "on", "t", "y"].includes(bool), redirects: integer("max_redirects", 10, 30), timeout: integer("timeout", 30, 120) };
}

export async function fetchUrl(request: Request, headers: Headers): Promise<Response> {
  const options = fetchOptions(new URL(request.url).searchParams);
  const agent = publicAgent();
  const deadline = AbortSignal.timeout(options.timeout * 1000);
  const signal = AbortSignal.any([request.signal, deadline]);
  let url = options.url;
  let count = 0;
  let streaming = false;
  try {
    while (true) {
      const upstream = await undiciFetch(url, { dispatcher: agent, redirect: "manual", signal });
      const location = upstream.headers.get("location");
      if (options.follow && location && [301, 302, 303, 307, 308].includes(upstream.status)) {
        await upstream.body?.cancel();
        if (count >= options.redirects) throw new ApiError(`重定向次數超過限制 (${options.redirects} 次)`, 500);
        url = parseTarget(new URL(location, url).href);
        count++;
        continue;
      }
      if (upstream.status >= 400) {
        await upstream.body?.cancel();
        throw new ApiError(upstream.status === 404 ? "找不到指定的資源" : upstream.status === 429 ? "請求過於頻繁，請稍後再試" : `HTTP 錯誤: ${upstream.status}`, upstream.status);
      }
      // fetch decodes Content-Encoding, so only an unencoded length describes the bytes we send.
      const length = upstream.headers.get("content-encoding") ? null : upstream.headers.get("content-length");
      if (length && Number(length) > MAX_BYTES) {
        await upstream.body?.cancel();
        throw new ApiError("檔案超過大小限制", 413);
      }
      const type = upstream.headers.get("content-type") || "application/octet-stream";
      let filename = basename(decodeURIComponent(url.pathname)) || "downloaded_file";
      if (!filename.includes(".") || filename.endsWith(".php")) {
        const extension = EXTENSIONS[type.split(";")[0].trim().toLowerCase()];
        if (extension) filename = filename.replace(/\.php$/, "") + extension;
      }
      headers.set("Content-Type", type);
      if (length) headers.set("Content-Length", length);
      headers.set("X-Final-URL", url.href);
      headers.set("X-Redirect-Count", String(count));
      headers.set("X-File-Extension", extname(filename).replace(/[^\x20-\x7e]/g, ""));
      const safeName = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
      headers.set("Content-Disposition", upstream.headers.get("content-disposition") || `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
      if (!upstream.body) return new Response(null, { headers });
      // The body still reads through the agent, so it closes the agent itself.
      const body = limitedBody(upstream.body as unknown as ReadableStream<Uint8Array>, MAX_BYTES, () => agent.destroy());
      streaming = true;
      return new Response(body, { headers });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (deadline.aborted) throw new ApiError("請求超時", 408);
    throw new ApiError("無法抓取目標伺服器的資源", 500);
  } finally {
    if (!streaming) await agent.destroy();
  }
}

// Headers are already sent while streaming, so an oversized or failed transfer can only abort the body.
function limitedBody(source: ReadableStream<Uint8Array>, maxBytes: number, onClose: () => Promise<void>): ReadableStream<Uint8Array> {
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
        if (size > maxBytes) throw new ApiError("檔案超過大小限制", 413);
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
