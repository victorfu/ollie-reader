import { ApiError, apiResponse, postOptions, readLimited } from "../../../../lib/api";
import { resolvePodcast } from "../../../../lib/podcasts";

export const runtime = "nodejs";
export const maxDuration = 30;
export const OPTIONS = postOptions;
export async function POST(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => {
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError("請使用 JSON 傳送單集網址", 400);
    const bytes = await readLimited(request as unknown as Response, 4096);
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError("無效的 JSON", 400); }
    const url = body && typeof body === "object" && "url" in body ? body.url : undefined;
    return Response.json(await resolvePodcast(url, request.signal), { headers });
  }, "POST");
}
