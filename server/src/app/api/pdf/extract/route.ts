import { apiResponse, ApiError, postOptions, readLimited } from "../../../../lib/api";
import { extractPdf, MAX_PDF_BYTES } from "../../../../lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) throw new ApiError("請使用 multipart/form-data 上傳 file", 400);
    // Bound multipart framing as well as the file; do not trust Content-Length.
    const bytes = await readLimited(new Response(request.body), MAX_PDF_BYTES + 64 * 1024);
    let form: FormData;
    try {
      form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    } catch { throw new ApiError("無效的 multipart/form-data", 400); }
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("缺少 file 檔案", 422);
    const result = await extractPdf(new Uint8Array(await file.arrayBuffer()), file.name, request.signal);
    return Response.json(result, { headers });
  }, "POST");
}
export const OPTIONS = postOptions;
