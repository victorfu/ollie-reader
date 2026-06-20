import { lazy } from "react";
import { logger } from "./logger";
import { isChunkLoadError } from "./chunkErrors";

const RELOAD_FLAG = "ollie:chunk-reloaded";

/**
 * Reloads the page once to fetch the latest build after a stale-chunk error.
 *
 * Guarded by sessionStorage so a genuinely broken chunk (still failing after a
 * fresh load) surfaces the real error instead of looping forever. Returns true
 * when a reload was triggered.
 */
export function reloadOnceForStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // sessionStorage may be unavailable (private mode, blocked storage). We
    // can't guard a loop in that case, so don't auto-reload.
    return false;
  }
  logger.warn("Stale chunk detected; reloading to fetch the latest build");
  window.location.reload();
  return true;
}

function clearReloadGuard(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // ignore — nothing to clear if storage is unavailable
  }
}

async function loadWithReload<T>(factory: () => Promise<T>): Promise<T> {
  try {
    const mod = await factory();
    // A successful load means the guard can be cleared so the next deploy can
    // recover the same way.
    clearReloadGuard();
    return mod;
  } catch (error) {
    if (isChunkLoadError(error) && reloadOnceForStaleChunk()) {
      // Hold the Suspense fallback until the reload navigates away, so the
      // ErrorBoundary never flashes the error screen.
      return new Promise<T>(() => {});
    }
    throw error;
  }
}

/**
 * Drop-in replacement for React.lazy that recovers from stale-chunk errors
 * (typically seen after a deploy) by reloading the page once. Mirrors React's
 * exact `lazy` signature so it composes with every route component.
 */
export const lazyWithReload: typeof lazy = (factory) =>
  lazy(() => loadWithReload(factory));
