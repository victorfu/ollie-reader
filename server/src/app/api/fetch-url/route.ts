import { apiResponse, getOptions } from "../../../lib/api";
import { fetchUrl } from "../../../lib/fetchUrl";

export const runtime = "nodejs";
export const maxDuration = 150;
export async function GET(request: Request): Promise<Response> {
  return apiResponse(request, (headers) => fetchUrl(request, headers));
}
export const OPTIONS = getOptions;
