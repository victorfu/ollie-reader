import { apiResponse, getOptions } from "../../../../lib/api";
import { verifyFirebaseToken } from "../../../../lib/firebaseAuth";
import { bookingRecords } from "../../../../lib/oikid";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => {
    await verifyFirebaseToken(request);
    return Response.json(await bookingRecords(request.signal), { headers });
  });
}
export const OPTIONS = getOptions;
