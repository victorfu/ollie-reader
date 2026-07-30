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

## Follow-up: remove spirits and share gacha tokens

Follow-up prompt: for `/games/spirit` 移除所有的圖鑑，還有圖鑑的元素，這個遊戲不需要精靈了；這個遊戲賺的錢全部都變成 `/games/gacha` 人氣角色扭蛋機的代幣（也就是人氣角色扭蛋機不免費了）。這工作跑一半被中斷，請繼續。

- Resumed from the existing partial worktree without discarding its changes.
- Audited remaining spirit/collection references and the shared Word Adventure ↔ gacha token flow before completing implementation.
- Removed the remaining visible companion and renamed the reachable game implementation to Word Adventure while retaining `/games/spirit` as the compatible route.
- Unified user-facing currency wording as gacha tokens and removed the reset-time starter balance so resetting cannot fund free draws.
- Changed adventure settlement to a Firestore transaction, added cross-tab balance refresh, prevented duplicate per-question rewards, and made daily token claims transactionally idempotent.
- Added a distinct gacha token-load error/retry state so connection failures are not misreported as an insufficient balance.
- Added a reset generation checked by adventure settlement, preventing a long-lived game tab from restoring progress after Settings resets it.
- Preserved the previous one-tab-per-game behavior for the new Word Adventure ↔ gacha links by sharing stable game-tab target names.
- Added direct service coverage for legacy spirit cleanup, paid draws, token settlement, same-day daily claims, and reset conflicts; targeted verification passes (8 files, 111 tests).
- Game-client QA confirmed both the home and stage map show gacha-token rewards with no spirit text or collection control; the actual gacha sign-in screen visibly states that each draw costs 50 tokens.
- Final verification passes: 64 test files (570 passed, 1 skipped), TypeScript, production build, and ESLint with 0 errors (3 pre-existing hook warnings).

## Follow-up TODO

- Production anti-tamper enforcement would additionally require Firestore Security Rules or a trusted backend; this repository currently contains neither rules nor backend deployment code.

## Follow-up: improve gacha link contrast

Follow-up prompt: 調整「去扭蛋機收集人氣角色」的文字顏色，深色底時使用淺色文字。

- Updated the Word Adventure gacha link to keep white text across its default, hover, and keyboard-focus states on the dark warning-color background.
- Visual QA confirmed the rendered foreground is `rgb(255, 255, 255)` in the dark-theme preview, with no console errors on the clean rerun.
- TypeScript and targeted ESLint checks pass.

## Follow-up TODO

- None.

## Follow-up: move empty-capsule rate into game settings

Follow-up prompt: 將「空膠囊機率」也調整到設定的遊戲去。

- Centralized the device-local empty-capsule rate in the shared gacha preferences service and added a reactive hook so open settings and gacha tabs stay synchronized.
- Moved the slider out of the gacha machine sidebar and into Settings → Game, while keeping the current probability visible in the game instructions.
- Added coverage for settings persistence, cross-tab updates, draw behavior, malformed storage, and the control being absent from the gacha screen; 3 targeted files (42 tests) and TypeScript pass.
- Visual QA confirmed the Game settings order is empty-capsule rate, full-collection preview, then reset progress, with no browser errors.
- Final verification passes: 64 test files (573 passed, 1 skipped), TypeScript, targeted ESLint, and the production build.

## Follow-up TODO

- None.

## Follow-up: correct gacha link hover color

Follow-up prompt: 「去扭蛋機收集人氣角色」正常狀態維持原本文字色，只有 hover 時改成白色。

- Removed the always-white and focus-white overrides; the link now keeps DaisyUI's normal foreground and applies white only while hovered.
- Visual QA confirmed the default state uses the original warning foreground on the pale background, while the hovered state computes to `rgb(255, 255, 255)` on the dark background; both runs had no console errors.
- TypeScript and targeted ESLint checks pass.

## Follow-up TODO

- None.

## Follow-up: implement Cloud Cottage pet game

Follow-up prompt: 實作 f0fee4a7e2016fb740ef2dfbe565ad9b6e2d44da 裡面的新遊戲 spec；實作前先 review spec，有問題可以討論，沒有問題就開始實作。

- Reviewing the approved Phase 1 design against the current standalone-game, Firebase, TTS, and shared-token architecture.
- Applying the repository art constraint by using Codex GPT-Image2 raster assets instead of the SVG character implementation proposed in the spec.
- Generated and visually checked a watercolor cloud-cottage room plus a transparent Cinnamoroll character cutout with the built-in GPT-Image2 workflow; optimized both as project-local WebP assets.
- Completed the Phase 1 domain model, deterministic daily wishes, stat decay, bond cap/unlocks, sleep lifecycle, canonical catalog, and 62 focused domain/storage tests.
- Added revision-aware local cache and Firestore transactions for care actions, consumables, permanent toys, and the shared Word Adventure coin balance.
- Added the standalone `/games/cottage` route, Little Games hub card, responsive cottage UI, generated WebAudio cues, TTS subtitles, offline state, cross-tab refresh, and browser-test hooks.
- Strict TypeScript now passes for the complete application.
- Hardened modal focus/inert behavior, hydration/reconnect races, authoritative transaction reconciliation, automatic 07:00 wake-up, unlocked phrase selection, idle performances, and full-snapshot Firestore writes so consumed snacks cannot reappear.
- Added UI coverage for the signed-out gate and the demo care loop; the full repository suite passes with 829 tests (1 skipped), `src` ESLint has no errors, and the production build succeeds.
- Playwright QA passed at 1280×720 and 375×667 for the initial layout, feeding, three-step bathing, shopping, petting, daily-wish completion, and the bond-unlock modal with no Cloud Cottage console/page errors.

## Follow-up TODO

- None.

## Follow-up: complete Cloud Cottage Phase 2

Follow-up prompt: 請繼續實作（完成 `f0fee4a7e2016fb740ef2dfbe565ad9b6e2d44da` 規格尚未實作的 Phase 2 個人化內容）。

- Confirmed the remaining committed scope: furniture/wallpaper/floor shop and freeform room editor, outfit shop and two-slot wardrobe, scene reactions, and retroactive bond-gift grants.
- Reusing the existing revision-aware canonical save document and transaction model; generated art must remain Codex GPT-Image2 raster WebP rather than the spec's SVG suggestion.
- Completed and tested the six-category catalog, permanent ownership rules, normalized room transitions, outfit slots, canonical personalization transactions, and idempotent L5/L8/L11/L14/L15/L18 gift backfill (119 Cloud Cottage tests passing at this milestone).
- Generated and visually checked an empty watercolor room plus transparent raster atlases for 14 furniture/gift objects and 9 outfits; removed chroma spill, split them into project-local WebP assets, and verified every exported sprite has alpha.
- Completed the responsive nine-action toolbar, six-category shop, freeform wall/floor room editor with drag and keyboard controls, deterministic z-order persistence, two-slot wardrobe with instant preview, anchored raster outfit layers, and furniture-aware pet reactions.
- Added atomic multi-action personalization commits and monotonic permanent-inventory reconciliation across cloud, cache, purchase, care, reconnect, and personalization paths so a newer offline snapshot cannot erase paid items or charge for them twice.
- Completed strict Phase 1 fidelity discovered during the final audit: queued entrance TTS after settings hydration, centralized dialogue, touch/pointer bubble rubbing, shake/sneeze/fluff bathing, five distinct toy animations, daytime naps, regular-level heart bursts, and the L20 room-wide heart/confetti celebration.
- Expanded `render_game_to_text` to expose every active panel/editor draft and deterministic time advancement; desktop and 375×667 Playwright QA covered the main scene, six-category shop, room editor, wardrobe, care animation, purchased-toy animation, and saved personalization round trips with no game console/page errors.
- Final verification passes: 70 test files (910 passed, 1 skipped), TypeScript, production build, and ESLint with 0 errors (3 pre-existing non-Cottage hook warnings).

## Follow-up TODO

- None.
