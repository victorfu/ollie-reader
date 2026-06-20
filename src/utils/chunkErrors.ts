/**
 * Detects errors thrown when a code-split chunk fails to load.
 *
 * After a deploy, content-hashed chunk filenames change. A tab (or installed
 * PWA whose service worker has purged the old precache) still references the
 * previous hashes, so the dynamic import requests a file that no longer exists.
 * Firebase Hosting's SPA rewrite (`** -> /index.html`) returns the HTML shell
 * for the missing asset, and the browser refuses to execute HTML as a module.
 *
 * Kept dependency-free so it stays a pure, testable leaf utility.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /expected a javascript.+but.+text\/html/i.test(message) ||
    /\bChunkLoadError\b/.test(message)
  );
}
