Original prompt: `/games/gacha?view=collection` 請在圖鑑加入可以點開某一個圖鑑看圖，還有加入一個開啟全部圖鑑的設定 (放在設定頁面)

## Progress

- Started repository reconnaissance for the gacha collection view and settings persistence.
- Added a local, display-only preference for revealing all gacha entries.
- Added the game-settings toggle without changing cloud-owned collection data.
- Made revealed collection cards interactive and added an accessible large-image dialog.
- Added focused coverage for persistence, settings UI, locked/revealed cards, cross-tab updates, dialog close/reopen, and focus restoration.
- Targeted feature tests pass (4 files, 37 tests); targeted TypeScript and ESLint checks pass.
- Verified the collection and settings flows at desktop and mobile sizes, including owned and preview-only character dialogs.
- Complete verification passes: 63 test files (558 passed, 1 skipped), TypeScript, ESLint (0 errors), and the production build.

## TODO

- None.

## Follow-up: reuse open game tabs

Follow-up prompt: 請在小遊戲 `/games` 下面的每一個小遊戲進入前都做此偵測!

- Confirmed that all six current game cards (plus the gacha collection shortcut) enter through `GameHub.openGame` and currently use a fresh `_blank` tab every time.
- Implement a stable tab identity per exact game URL, focus a live cached tab without reloading it, and let the browser reuse the same named tab after a hub reload.
- Added the shared launcher behavior to `GameHub`: live matching tabs are focused without navigation; closed tabs reopen; every exact URL receives a stable named browsing context.
- Added `GameHub` coverage for all seven entry URLs, duplicate focus, hub remounts, closed-tab reopening, and popup blocking.
- Browser QA confirmed that clicking Bunny twice kept the same tab ID, while the distinct gacha collection URL opened one separate tab; repeating it also reused that tab. The game-client screenshot/state showed all six cards and no console errors.
- Final verification passes: 64 test files (559 passed, 1 skipped), TypeScript, production build, and ESLint with 0 errors (3 pre-existing hook warnings).

## Follow-up TODO

- None.
