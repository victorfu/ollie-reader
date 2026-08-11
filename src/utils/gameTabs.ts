const gameTabs = new Map<string, Window>();

function resolveGameUrl(to: string): { url: URL; key: string } {
  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin) {
    throw new Error("Game tabs must use same-origin URLs.");
  }
  return { url, key: `${url.pathname}${url.search}${url.hash}` };
}

export function getGameTabTargetName(to: string): string {
  const { key } = resolveGameUrl(to);
  return `ollie-game-${encodeURIComponent(key)}`;
}

export function openGameTab(to: string): Window | null {
  const { url, key } = resolveGameUrl(to);
  const existingTab = gameTabs.get(key);

  if (existingTab && !existingTab.closed) {
    existingTab.focus();
    return existingTab;
  }

  // Open an empty URL first so a named browsing context that survived a hard
  // Hub reload is returned without navigating (and therefore reloading) it.
  const openedTab = window.open("", getGameTabTargetName(to));
  if (!openedTab) return null;

  try {
    if (openedTab.location.href.startsWith("about:blank")) {
      openedTab.location.href = url.href;
    }
  } catch {
    // A named tab may have navigated cross-origin. Its name still identifies
    // the existing game context, so preserve and focus it instead of reloading.
  }

  gameTabs.set(key, openedTab);
  openedTab.focus();
  return openedTab;
}
