import { ApiError, apiResponse, preflight, readLimited, waitWithSignal } from "../../../../lib/api";
import { verifyFirebaseToken } from "../../../../lib/firebaseAuth";
import { verifyTranslationAccess } from "../../../../lib/translationAccess";
import { translateWithOpenAI } from "../../../../lib/openaiTranslation";

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => {
    const deadline = new AbortController();
    const timer = setTimeout(() => {
      deadline.abort(new ApiError("翻譯請求逾時，請稍後再試", 504));
    }, 110_000);
    const signal = AbortSignal.any([request.signal, deadline.signal]);
    try {
      signal.throwIfAborted();
      const identity = await waitWithSignal(verifyFirebaseToken(request), signal);
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
        throw new ApiError("Content-Type 必須是 application/json", 415);
      }
      const bytes = await readLimited(request, 64 * 1024, signal);
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new ApiError("無效的 JSON 請求內容", 400);
      }
      await verifyTranslationAccess(request, identity, signal);
      const text = await translateWithOpenAI(body, signal);
      return Response.json({ text }, { headers });
    } finally {
      clearTimeout(timer);
    }
  }, "POST");
}
export function OPTIONS(request: Request) {
  return preflight(request, "POST", ["X-Firebase-AppCheck"]);
}
