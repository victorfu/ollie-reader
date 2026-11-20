import { corsHeaders } from "./cors";
import { logger } from "../utils/logger";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function apiResponse(request: Request, handler: (headers: Headers) => Promise<Response>, method: "GET" | "POST" = "GET"): Promise<Response> {
  let headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  try {
    const cors = corsHeaders(request, method);
    headers = cors.headers;
    if (!cors.allowed) throw new ApiError("不允許的來源", 403);
    return await handler(headers);
  } catch (error) {
    const status = request.signal.aborted ? 499 : error instanceof ApiError ? error.status : 500;
    const detail = request.signal.aborted ? "請求已取消" : error instanceof ApiError ? error.message : "伺服器錯誤，請稍後再試";
    if (status >= 500) logger.error(`API ${status}: ${detail}`);
    return Response.json({ detail }, { status, headers });
  }
}

export async function getOptions(request: Request): Promise<Response> {
  return preflight(request, "GET");
}

export async function postOptions(request: Request): Promise<Response> {
  return preflight(request, "POST");
}

export async function preflight(request: Request, allowedMethod: "GET" | "POST", extraHeaders: string[] = []): Promise<Response> {
  return apiResponse(request, async (headers) => {
    const method = request.headers.get("access-control-request-method");
    const requested = (request.headers.get("access-control-request-headers") || "").split(",");
    const allowedHeaders = ["Content-Type", "Authorization", ...extraHeaders];
    if (allowedMethod === "GET") allowedHeaders.push("Cache-Control");
    const normalized = allowedHeaders.map((name) => name.toLowerCase());
    if ((method && method !== allowedMethod) || requested.some((h) => h.trim() && !normalized.includes(h.trim().toLowerCase()))) {
      throw new ApiError("不支援的預檢請求", 403);
    }
    headers.set("Access-Control-Allow-Headers", allowedHeaders.join(", "));
    return new Response(null, { status: 204, headers });
  }, allowedMethod);
}

// Stop waiting for non-cancellable or shared work without cancelling other callers.
export async function waitWithSignal<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  const aborted = Promise.withResolvers<never>();
  const onAbort = () => aborted.reject(signal.reason);
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([aborted.promise, work]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export async function readLimited(response: Pick<Response, "body">, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  signal?.throwIfAborted();
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", onAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new ApiError("檔案超過大小限制", 413);
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks));
}
