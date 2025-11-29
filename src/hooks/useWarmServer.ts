import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { VERSION_API_URL } from "../constants/api";

type Options = {
  enabled?: boolean;
  timeoutMs?: number;
  /**
   * When true, ping on every route change; otherwise only once on mount.
   * Defaults to false to avoid repeated network calls on flaky connections.
   */
  triggerOnRouteChange?: boolean;
};

/**
 * Warm-start the backend by calling /api/version.
 * By default it runs once on mount; set triggerOnRouteChange to true to run on every navigation.
 * Fire-and-forget; failures are ignored.
 */
export function useWarmServerOnRouteChange(options: Options = {}) {
  const {
    enabled = true,
    timeoutMs = 5000,
    triggerOnRouteChange = false,
  } = options;
  const location = useLocation();
  const triggerKey = triggerOnRouteChange ? location.pathname : "app-mount";

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    fetch(VERSION_API_URL, {
      method: "GET",
      signal: controller.signal,
      // Helps when navigating away in some scenarios
      keepalive: true,
      headers: {
        "cache-control": "no-cache",
      },
    })
      .catch(() => {
        // best-effort warm start, ignore errors
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [triggerKey, enabled, timeoutMs]);
}
