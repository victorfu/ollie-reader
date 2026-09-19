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

async function preflight(request: Request, allowedMethod: "GET" | "POST"): Promise<Response> {
  return apiResponse(request, async (headers) => {
    const method = request.headers.get("access-control-request-method");
    const requested = (request.headers.get("access-control-request-headers") || "").split(",");
    const allowedHeaders = allowedMethod === "GET" ? ["authorization", "content-type", "cache-control"] : ["content-type"];
    if ((method && method !== allowedMethod) || requested.some((h) => h.trim() && !allowedHeaders.includes(h.trim().toLowerCase()))) {
      throw new ApiError("不支援的預檢請求", 403);
    }
    return new Response(null, { status: 204, headers });
  }, allowedMethod);
}

export async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new ApiError("檔案超過大小限制", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks));
}
