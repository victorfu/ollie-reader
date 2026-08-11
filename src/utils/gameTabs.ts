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

function focusOrNavigateGameTab(tab: Window, targetUrl: URL): void {
  try {
    if (tab.location.href.startsWith("about:blank")) {
      tab.location.href = targetUrl.href;
      tab.focus();
      return;
    }
    const currentUrl = new URL(tab.location.href, targetUrl);
    const currentLocation = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    const targetLocation = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    if (
      currentUrl.origin === targetUrl.origin &&
      currentLocation !== targetLocation
    ) {
      tab.location.href = targetUrl.href;
    }
  } catch {
    // A named context may have navigated cross-origin. We cannot inspect or
    // safely redirect it, so leave that user-controlled page untouched.
  }
  tab.focus();
}

export function openGameTab(to: string): Window | null {
  const { url, key } = resolveGameUrl(to);
  const existingTab = gameTabs.get(key);

  if (existingTab && !existingTab.closed) {
    focusOrNavigateGameTab(existingTab, url);
    return existingTab;
  }

  // Open an empty URL first so a named browsing context that survived a hard
  // Hub reload is returned without navigating (and therefore reloading) it.
  const openedTab = window.open("", getGameTabTargetName(to));
  if (!openedTab) return null;

  focusOrNavigateGameTab(openedTab, url);

  gameTabs.set(key, openedTab);
  return openedTab;
}
