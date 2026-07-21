Original prompt: `/games/gacha?view=collection` 請在圖鑑加入可以點開某一個圖鑑看圖，還有加入一個開啟全部圖鑑的設定 (放在設定頁面)

## Progress

- Started repository reconnaissance for the gacha collection view and settings persistence.
- Added a local, display-only preference for revealing all gacha entries.
- Added the game-settings toggle without changing cloud-owned collection data.
- Made revealed collection cards interactive and added an accessible large-image dialog.
- Added focused coverage for persistence, settings UI, locked/revealed cards, cross-tab updates, dialog close/reopen, and focus restoration.
- Targeted feature tests pass (4 files, 37 tests); targeted TypeScript and ESLint checks pass.
- Verified the collection and settings flows at desktop and mobile sizes, including owned and preview-only character dialogs.
- Complete verification passes: 63 test files (557 passed, 1 skipped), TypeScript, ESLint (0 errors), and the production build.

## TODO

- None.
