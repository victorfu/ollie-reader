import { apiResponse, getOptions } from "../../../lib/api";
import { fetchUrl } from "../../../lib/fetchUrl";
import { verifyFirebaseToken } from "../../../lib/firebaseAuth";

export const runtime = "nodejs";
export const maxDuration = 150;
export async function GET(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => {
    await verifyFirebaseToken(request);
    return fetchUrl(request, headers);
  });
}
export const OPTIONS = getOptions;
