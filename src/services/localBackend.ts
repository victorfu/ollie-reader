import { API_BASE_URL, LOCAL_BASE_URL, VERSION_PATH } from "../constants/api";
import { logger } from "../utils/logger";

// 探測結果的快取存活時間：在此期間不重複探測
const PROBE_TTL_MS = 10_000;
const PROBE_TIMEOUT_MS = 400;

let resolvedBase = API_BASE_URL; // 預設雲端
let lastProbeAt = 0;
let inflight: Promise<string> | null = null;

async function probeLocal(): Promise<boolean> {
  try {
    const resp = await fetch(`${LOCAL_BASE_URL}${VERSION_PATH}`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 回傳 pdf/tts/ktts 應使用的 base：本機探測得到用本機，否則雲端。
 * 結果快取 PROBE_TTL_MS；同時間多次呼叫共用同一個 inflight 探測。
 */
export async function getComputeBase(): Promise<string> {
  const now = Date.now();
  if (now - lastProbeAt < PROBE_TTL_MS) {
    return resolvedBase;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const ok = await probeLocal();
    resolvedBase = ok ? LOCAL_BASE_URL : API_BASE_URL;
    lastProbeAt = Date.now();
    logger.debug("compute base resolved:", resolvedBase);
    inflight = null;
    return resolvedBase;
  })();
  return inflight;
}

/** 同步取得目前已解析的 base（不觸發探測），UI 顯示用。 */
export function getResolvedBaseSync(): string {
  return resolvedBase;
}

/** 強制立即重新探測（desktop 啟停後可呼叫）。 */
export async function refreshComputeBase(): Promise<string> {
  lastProbeAt = 0;
  return getComputeBase();
}
