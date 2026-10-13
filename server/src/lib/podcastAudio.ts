import { fetch as publicFetch } from "undici";
import { parseBuffer } from "music-metadata";
import { ApiError, readLimited } from "./api";
import { parseTarget, publicAgent } from "./fetchUrl";

export const MAX_AUDIO_BYTES = 80 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 30 * 60;
const MIME_TYPES = new Map([
  ["audio/mpeg", "audio/mpeg"], ["audio/mp3", "audio/mpeg"],
  ["audio/mp4", "audio/mp4"], ["audio/x-m4a", "audio/mp4"], ["audio/m4a", "audio/mp4"],
  ["audio/aac", "audio/aac"], ["audio/ogg", "audio/ogg"],
  ["audio/webm", "audio/webm"],
  ["audio/wav", "audio/wav"], ["audio/x-wav", "audio/wav"], ["audio/flac", "audio/flac"],
]);

/** Only called with a freshly resolved RSS enclosure, never a client audio URL. */
export async function downloadPodcastAudio(source: string, requestSignal: AbortSignal) {
  const agent = publicAgent();
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(45_000)]);
  let url = parseTarget(source);
  try {
    for (let redirects = 0; ; redirects++) {
      if (url.protocol !== "https:" || url.port) throw new ApiError("音訊必須使用公開 HTTPS 來源", 422);
      const response = await publicFetch(url, { dispatcher: agent, redirect: "manual", signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || redirects >= 5) throw new ApiError("音訊重新導向過多或無效", 502);
        url = parseTarget(new URL(location, url).href);
        continue;
      }
      const mimeType = MIME_TYPES.get((response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase());
      if (!response.ok || !mimeType || Number(response.headers.get("content-length")) > MAX_AUDIO_BYTES) {
        await response.body?.cancel();
        if (!response.ok) throw new ApiError("無法下載 Podcast 音訊，請稍後重試", 502);
        if (!mimeType) throw new ApiError("此音訊格式目前無法轉錄", 415);
        throw new ApiError("音訊超過 80 MiB 限制", 413);
      }
      const bytes = await readLimited(response as unknown as Response, MAX_AUDIO_BYTES);
      signal.throwIfAborted();
      // Verify the actual media rather than trusting client/RSS duration or MIME alone.
      let duration: number | undefined;
      try {
        duration = (await parseBuffer(bytes, { mimeType, size: bytes.length }, { duration: true, skipCovers: true })).format.duration;
      } catch { throw new ApiError("音訊內容無法辨識", 415); }
      signal.throwIfAborted();
      if (!duration || !Number.isFinite(duration)) throw new ApiError("無法確認音訊長度，暫時無法轉錄", 422);
      if (duration > MAX_AUDIO_SECONDS) throw new ApiError("目前支援最長 30 分鐘的單集", 413);
      return { bytes, mimeType, duration };
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted) throw new ApiError("音訊下載逾時，請稍後重試", 504);
    throw new ApiError("無法安全下載音訊，來源可能失效或不允許存取", 502);
  } finally { await agent.destroy(); }
}
