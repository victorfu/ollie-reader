import { corsHeaders } from "../../../lib/cors";
import { synthesizeSpeech } from "../../../lib/edgeTts";
import { parseSpeechRequest, SpeechError } from "../../../lib/speech";
import { logger } from "../../../utils/logger";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_BODY_BYTES = 64 * 1024;

async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new SpeechError("Content-Type 必須是 application/json", 400);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new SpeechError("請提供 JSON 請求內容", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      request.signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new SpeechError("請求內容過大", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SpeechError("無效的 JSON 請求內容", 400);
  }
}

export async function POST(request: Request): Promise<Response> {
  let headers = new Headers({ "Cache-Control": "no-store", "Vary": "Origin" });
  try {
    const cors = corsHeaders(request);
    headers = cors.headers;
    if (!cors.allowed) throw new SpeechError("不允許的來源", 403);
    const input = parseSpeechRequest(await readJson(request));
    const audio = await synthesizeSpeech(input, request.signal);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Content-Disposition", 'attachment; filename="speech.mp3"');
    return new Response(audio, { headers });
  } catch (error) {
    const aborted = request.signal.aborted || (error instanceof Error && error.name === "AbortError");
    const status = aborted ? 499 : error instanceof SpeechError ? error.status : 500;
    const detail = aborted ? "語音請求已取消" : error instanceof SpeechError ? error.message : "Edge 語音合成失敗";
    if (status >= 500) logger.error(`${status}: ${detail}`);
    return Response.json({ detail }, { status, headers });
  }
}

export function OPTIONS(request: Request): Response {
  try {
    const { headers, allowed } = corsHeaders(request);
    if (!allowed) return Response.json({ detail: "不允許的來源" }, { status: 403, headers });
    const method = request.headers.get("access-control-request-method");
    const requestedHeaders = request.headers.get("access-control-request-headers") || "";
    if ((method && method !== "POST") || requestedHeaders.split(",").some(
      (header) => header.trim() && header.trim().toLowerCase() !== "content-type",
    )) {
      return Response.json({ detail: "不支援的預檢請求" }, { status: 403, headers });
    }
    return new Response(null, { status: 204, headers });
  } catch {
    logger.error("CORS 設定無效");
    return Response.json({ detail: "伺服器 CORS 設定無效" }, {
      status: 500, headers: { "Cache-Control": "no-store", "Vary": "Origin" },
    });
  }
}
