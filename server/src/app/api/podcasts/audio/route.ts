import { ApiError, apiResponse, readLimited } from "../../../../lib/api";
import { verifyFirebaseToken } from "../../../../lib/firebaseAuth";
import { parseApplePodcastUrl, resolvePodcast } from "../../../../lib/podcasts";
import { downloadPodcastAudio } from "../../../../lib/podcastAudio";
import { preparePodcastAudio } from "../../../../lib/podcastAudioPreparation";

export const runtime = "nodejs";
export const maxDuration = 150;
// CPU/download protection per warm instance. Gemini quotas remain in Firebase AI Logic.
const active = new Set<string>();
const starts = new Map<string, number>();

export async function OPTIONS(request: Request) {
  return apiResponse(request, async (headers) => {
    if (request.headers.get("access-control-request-method") !== "POST" || (request.headers.get("access-control-request-headers") || "").split(",").some((h) => h.trim() && !["content-type", "authorization", "x-firebase-appcheck"].includes(h.trim().toLowerCase()))) throw new ApiError("不支援的預檢請求", 403);
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
    return new Response(null, { status: 204, headers });
  }, "POST");
}

export async function POST(request: Request) {
  return apiResponse(request, async (headers) => {
    const user = await verifyFirebaseToken(request);
    if (!user.email_verified || !user.email) throw new ApiError("請使用已授權的帳號登入", 403);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(130_000)]);
    const authorization = new Headers({ Authorization: request.headers.get("authorization")! });
    const appCheck = request.headers.get("X-Firebase-AppCheck");
    if (appCheck) authorization.set("X-Firebase-AppCheck", appCheck);
    // Reuse the user's Firestore rules and token; no Admin credential/private key.
    const allowed = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(process.env.FIREBASE_PROJECT_ID!)}/databases/(default)/documents/allowedUsers/${encodeURIComponent(user.email)}`, {
      headers: authorization, signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
    await allowed.body?.cancel();
    if (!allowed.ok) throw new ApiError(allowed.status >= 500 ? "無法確認使用權限，請稍後重試" : "此帳號沒有使用權限", allowed.status >= 500 ? 503 : 403);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError("請使用 JSON", 400);
    let body;
    try { body = JSON.parse(new TextDecoder().decode(await readLimited(request as unknown as Response, 8192))); }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError("無效的 JSON", 400); }
    if (!body || typeof body.guid !== "string" || !body.guid.trim() || body.guid.length > 2048) throw new ApiError("無效的單集識別", 400);
    const ids = parseApplePodcastUrl(body.sourceUrl);
    for (const [uid, started] of starts) if (Date.now() - started > 60_000) starts.delete(uid);
    if (active.has(user.uid) || starts.has(user.uid) || active.size >= 4 || starts.size >= 1000) throw new ApiError("音訊準備中或請求過於頻繁，請稍後重試", 429);
    active.add(user.uid); starts.set(user.uid, Date.now());
    try {
      const resolution = await resolvePodcast(ids.sourceUrl, signal);
      const episode = "episodes" in resolution ? resolution.episodes.find((entry) => entry.guid === body.guid) : resolution;
      if (!episode || episode.guid !== body.guid || episode.podcastId !== ids.podcastId) throw new ApiError("RSS 中找不到指定單集，請重新載入", 422);
      const prepared = await preparePodcastAudio(await downloadPodcastAudio(episode.audioUrl, signal), signal);
      headers.set("Content-Type", "audio/webm");
      headers.set("Content-Length", String(prepared.bytes.length));
      headers.set("X-Audio-Duration", String(prepared.duration));
      headers.set("Access-Control-Expose-Headers", "X-Audio-Duration");
      return new Response(prepared.bytes, { headers });
    } finally { active.delete(user.uid); }
  }, "POST");
}
