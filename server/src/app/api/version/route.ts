import { apiResponse, getOptions } from "../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => Response.json({ version: process.env.API_VERSION || "1.0.1" }, { headers }));
}
export const OPTIONS = getOptions;
