import { ApiError, apiResponse, preflight, readLimited } from "../../../../lib/api";
import { verifyFirebaseToken } from "../../../../lib/firebaseAuth";
import { verifyTranslationAccess } from "../../../../lib/translationAccess";
import { translateWithOpenAI } from "../../../../lib/openaiTranslation";

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => {
    const identity = await verifyFirebaseToken(request);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new ApiError("Content-Type 必須是 application/json", 415);
    }
    const bytes = await readLimited(request, 64 * 1024);
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new ApiError("無效的 JSON 請求內容", 400);
    }
    await verifyTranslationAccess(request, identity);
    const text = await translateWithOpenAI(body, request.signal);
    return Response.json({ text }, { headers });
  }, "POST");
}
export function OPTIONS(request: Request) {
  return preflight(request, "POST", ["X-Firebase-AppCheck"]);
}
