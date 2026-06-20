import { registerSW } from "virtual:pwa-register";
import { logger } from "./logger";

// How often a long-open tab re-checks the server for a newer build. We also
// check on focus / tab visibility so a deploy is usually picked up the moment
// the user looks at the tab.
const UPDATE_CHECK_INTERVAL_MS = 60_000;

/**
 * Registers the PWA service worker and keeps every open tab on the latest
 * build.
 *
 * With `registerType: "autoUpdate"`, vite-plugin-pwa reloads the page
 * automatically as soon as a new build's service worker takes control. The
 * catch: the browser only re-checks for a new worker on a hard navigation, and
 * SPA route changes (React Router) don't count — so a tab left open never
 * notices a deploy. We poll periodically and on focus/visibility to close that
 * gap, turning "I deployed" into "every open tab reloads itself".
 */
export function registerPwa(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = () => {
        if (registration.installing || !navigator.onLine) return;
        registration.update().catch((error: unknown) => {
          logger.warn("Service worker update check failed", error);
        });
      };

      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      window.addEventListener("focus", checkForUpdate);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
    },
    onRegisterError(error: unknown) {
      logger.error("Service worker registration failed", error);
    },
  });
}
