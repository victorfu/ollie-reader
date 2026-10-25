import { apiResponse, getOptions } from "../../../../lib/api";
import { proxyPodcastAudio } from "../../../../lib/podcastAudio";

// Media elements cannot send a Firebase token. The signed URL issued by the
// authenticated resolver is the credential, and binds the exact enclosure URL.
export const runtime = "nodejs";
export const maxDuration = 60;
export const OPTIONS = getOptions;
export async function GET(request: Request): Promise<Response> {
  return apiResponse(request, (headers) => proxyPodcastAudio(request, headers));
}
