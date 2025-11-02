import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { VERSION_API_URL } from "../constants/api";

type Options = {
  enabled?: boolean;
  timeoutMs?: number;
};

/**
 * Warm-start the backend by calling /api/version whenever the route changes.
 * Fire-and-forget; failures are ignored.
 */
export function useWarmServerOnRouteChange(options: Options = {}) {
  const { enabled = true, timeoutMs = 5000 } = options;
  const location = useLocation();

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
  }, [location.pathname, enabled, timeoutMs]);
}
