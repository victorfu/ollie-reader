import { useCallback, useEffect, useState } from "react";
import {
  SIGNED_URL_REFRESH_MARGIN_MS,
  SIGNED_URL_TTL_SECONDS,
} from "../constants/questionBank";
import { STORAGE_BUCKET, supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

interface CacheEntry {
  url: string;
  expiresAt: number;
}

/** 模組層級快取：跨元件共用，同一頁圖不重複簽（spec §9）。 */
const cache = new Map<string, CacheEntry>();

export function resetSignedUrlCache(): void {
  cache.clear();
}

function isFresh(entry: CacheEntry | undefined, now: number): entry is CacheEntry {
  return entry !== undefined && entry.expiresAt - now > SIGNED_URL_REFRESH_MARGIN_MS;
}

export async function fetchSignedUrls(
  paths: readonly string[],
  force = false,
): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = [...new Set(paths)].filter((path) => force || !isFresh(cache.get(path), now));

  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    const expiresAt = now + SIGNED_URL_TTL_SECONDS * 1000;
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        cache.set(item.path, { url: item.signedUrl, expiresAt });
      }
    }
  }

  const urls: Record<string, string> = {};
  for (const path of paths) {
    const entry = cache.get(path);
    if (entry) urls[path] = entry.url;
  }
  return urls;
}

export function useSignedPageUrls(paths: readonly string[]) {
  // 用內容當 key：呼叫端每次 render 產生新陣列也不會重抓。
  const key = [...new Set(paths)].sort().join("\n");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (key === "") return;
    let cancelled = false;
    fetchSignedUrls(key.split("\n"))
      .then((result) => {
        if (cancelled) return;
        setUrls((previous) => ({ ...previous, ...result }));
        setFailed(false);
      })
      .catch((error: unknown) => {
        logger.warn("[useSignedPageUrls] failed to sign page urls", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const refresh = useCallback(async (path: string) => {
    try {
      const result = await fetchSignedUrls([path], true);
      setUrls((previous) => ({ ...previous, ...result }));
    } catch (error) {
      logger.warn("[useSignedPageUrls] refresh failed", error);
    }
  }, []);

  return { urls, failed, refresh };
}
