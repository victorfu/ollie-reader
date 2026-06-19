import { API_BASE_URL, LOCAL_BASE_URL, VERSION_PATH } from "../constants/api";
import { logger } from "../utils/logger";
import type { ComputeMode } from "../types/pdf";

// per-device 連線模式設定（不同步 Firestore）
const COMPUTE_MODE_KEY = "ollie-reader-compute-mode";
const PROBE_TIMEOUT_MS = 400;

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

// session 內的解析狀態
let resolvedBase = API_BASE_URL; // 預設雲端
let hasProbed = false; // auto 模式本 session 是否已探測過
let localReachable: boolean | null = null; // 最近一次探測/請求結果；null = 尚未探測
let inflight: Promise<string> | null = null;

/** 讀目前連線模式（預設 auto）。 */
export function getComputeMode(): ComputeMode {
  try {
    const stored = localStorage.getItem(COMPUTE_MODE_KEY);
    if (stored === "auto" || stored === "local" || stored === "cloud") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "auto";
}

/** 寫連線模式並重置 session 解析狀態。 */
export function setComputeMode(mode: ComputeMode): void {
  try {
    localStorage.setItem(COMPUTE_MODE_KEY, mode);
  } catch {
    // localStorage not available
  }
  hasProbed = false;
  inflight = null;
  localReachable = null;
  resolvedBase = mode === "local" ? LOCAL_BASE_URL : API_BASE_URL;
}

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
 * 回傳 pdf/tts/ktts 應使用的 base：
 *   cloud → API_BASE_URL（不探測）
 *   local → LOCAL_BASE_URL（不探測）
 *   auto  → 本 session 探測過用快取，否則探一次（探到本機用本機，否則雲端）
 */
export async function getComputeBase(): Promise<string> {
  const mode = getComputeMode();
  if (mode === "cloud") {
    resolvedBase = API_BASE_URL;
    return resolvedBase;
  }
  if (mode === "local") {
    resolvedBase = LOCAL_BASE_URL;
    return resolvedBase;
  }
  // auto
  if (hasProbed) return resolvedBase;
  if (inflight) return inflight;
  inflight = (async () => {
    const ok = await probeLocal();
    localReachable = ok;
    resolvedBase = ok ? LOCAL_BASE_URL : API_BASE_URL;
    hasProbed = true;
    inflight = null;
    logger.debug("compute base resolved:", resolvedBase);
    return resolvedBase;
  })();
  return inflight;
}

/**
 * 強制探測一次本機並更新狀態。
 *   auto  → 重探，resolvedBase = 本機（通）否則雲端
 *   local → 探測只為更新 localReachable；resolvedBase 維持 LOCAL_BASE_URL
 *   cloud → 不探測，resolvedBase = 雲端
 */
export async function refreshComputeBase(): Promise<string> {
  const mode = getComputeMode();
  if (mode === "cloud") {
    resolvedBase = API_BASE_URL;
    localReachable = null;
    return resolvedBase;
  }
  const ok = await probeLocal();
  localReachable = ok;
  if (mode === "local") {
    resolvedBase = LOCAL_BASE_URL;
  } else {
    hasProbed = true;
    resolvedBase = ok ? LOCAL_BASE_URL : API_BASE_URL;
  }
  logger.debug("compute base refreshed:", resolvedBase, "local:", ok);
  return resolvedBase;
}

export type ComputeStatus = {
  mode: ComputeMode;
  resolvedBase: string;
  usingLocal: boolean;
  localReachable: boolean | null;
};

/** 同步取得目前狀態（不觸發網路），UI 顯示用。 */
export function getComputeStatusSync(): ComputeStatus {
  const mode = getComputeMode();
  const base =
    mode === "cloud"
      ? API_BASE_URL
      : mode === "local"
        ? LOCAL_BASE_URL
        : resolvedBase;
  return {
    mode,
    resolvedBase: base,
    usingLocal: base === LOCAL_BASE_URL,
    localReachable,
  };
}

/** 連線層級失敗（網路/連不上），非 HTTP 狀態碼錯誤。fetch 失敗會丟 TypeError。 */
export function isLocalConnectionError(err: unknown): boolean {
  return err instanceof TypeError;
}

/** local 模式 sidecar 連不上時的使用者訊息。 */
export function localUnavailableMessage(): string {
  return "本機 sidecar 未連線，請先啟動桌面 App，或在設定改用雲端。";
}

/**
 * 用解析後的 base 發送請求；auto 模式下若送往本機的請求發生連線層級失敗，
 * 自動 refresh（改用雲端）並重試一次。fetcher 預設用全域 fetch，TTS 傳 apiFetch。
 */
export async function fetchWithComputeBase(
  path: string,
  init: RequestInit,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const base = await getComputeBase();
  try {
    return await fetcher(`${base}${path}`, init);
  } catch (err) {
    if (
      getComputeMode() === "auto" &&
      base === LOCAL_BASE_URL &&
      isLocalConnectionError(err)
    ) {
      const cloudBase = await refreshComputeBase();
      return fetcher(`${cloudBase}${path}`, init);
    }
    throw err;
  }
}
