import { PODCAST_API_BASE_URL } from "../constants/api";
import type { PodcastResolution } from "../types/podcast";

export async function resolvePodcast(url: string, signal: AbortSignal): Promise<PodcastResolution> {
  // Podcast resolution lives only in the Next.js backend, not the desktop sidecar.
  const response = await fetch(`${PODCAST_API_BASE_URL}/api/podcasts/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
  });
  const data = await response.json().catch(() => null);
  const detail = typeof data?.detail === "string" ? data.detail : null;
  if (response.status === 404 && (!detail || detail.toLowerCase() === "not found")) {
    throw new Error("Podcast 服務尚未啟用，請啟動或更新 Podcast 後端後重試。");
  }
  if (!response.ok) throw new Error(detail || "無法載入 Podcast，請稍後再試");
  if (!data || (typeof data.audioUrl !== "string" && !(data.kind === "show" && Array.isArray(data.episodes)))) {
    throw new Error("Podcast 服務回應格式不正確，請更新後端後重試。");
  }
  return data as PodcastResolution;
}
