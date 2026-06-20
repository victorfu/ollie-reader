# Design: Port Ollie Little Games into Ollie Reader

<status>Approved 2026-06-20</status>

## Goal

Bring the three canvas mini-games from the standalone `ollie-little-games`
repo (`/Users/victor/Documents/ollie-little-games`) into the Ollie Reader web
app as a new **「小遊戲」** section, surfaced from the sidebar.

The three games:

- **Bunny Jumper** — endless vertical jumper (canvas 480×800)
- **Meteor Glider** — meteor dodge with dash meter (canvas 480×720)
- **森林蘑菇冒險 / Mushroom Adventure** — side-scrolling platformer, 10 levels (canvas 960×540)

## Context / findings

- The 3 game components + `GameHub` are **self-contained**: they depend only on
  React and four local `lib/` files. No `@github/spark`, Phosphor, Heroicons,
  framer-motion, shadcn/ui, `cn()`, or custom theme tokens in their markup.
- The source app uses an `@/` path alias; **the web app has no `@/` alias**, so
  game imports must be rewritten to relative paths.
- The web app already has a `/game` route = 「精靈探險」 (a separate
  English-learning RPG under `src/components/Game/`). The arcade games are a
  **new** section, not a replacement.
- The web app surfaces routes via a sidebar `navItems` array in `src/App.tsx`
  and lazy-loaded `<Route>` elements; labels are in Chinese; icons from
  `lucide-react`.
- No test runner exists in this repo (verify via build + lint + manual).

## Decisions (confirmed with user)

1. **Navigation:** single sidebar entry 「小遊戲」 → a game-hub page with three
   cards → sub-routes per game. (Mirrors the source app's hub structure.)
2. **Styling:** the **hub page is redesigned** to match the macOS HIG / DaisyUI
   design system; the **game content (canvas + in-game menu/pause/back chrome)
   is kept as-is**.
3. **Persistence:** best scores stay in `localStorage` (existing keys); no
   Firebase sync.

## Approach — copy in as a self-contained module

Copy the game sources into the web app's source tree (not a git submodule or
npm workspace package). Zero external coupling means a plain copy keeps the
games self-contained and requires no build-tooling changes. The only required
adaptation is rewriting `@/lib/*` imports to relative paths.

*Alternatives considered:* submodule (rejected — source is a separate Vite/Spark
app, not a library) and npm workspace package (rejected — overkill for ~4 small
helper files). Copy-in is the YAGNI choice.

## File layout in the web app

New feature folder `src/components/LittleGames/`, kept distinct from the
existing `src/components/Game/` (精靈探險 RPG):

```
src/components/LittleGames/
├── GameHub.tsx           # REDESIGNED to match design system
├── BunnyJumper.tsx       # ported as-is (canvas + menu chrome)
├── MeteorGlider.tsx      # ported as-is
├── MushroomAdventure.tsx # ported as-is
└── lib/
    ├── constants.ts      # GAME_CONFIG, MUSHROOM_CONFIG
    ├── types.ts
    ├── game-utils.ts     # checkCollision, clamp, randomInt, get/setBestScore
    └── game-objects.ts
```

- Helpers stay local to the module (NOT merged into `src/utils`) to avoid symbol
  clashes such as `clamp` / `randomInt`.
- The source's `spirits/` folder is **not** copied — none of the 3 games import it.

## Routing & navigation

In `src/App.tsx`:

- Add one sidebar entry to `navItems`:
  `{ to: "/games", label: "小遊戲", icon: Joystick }`
  (distinct `lucide-react` icon from 精靈探險's `Gamepad2`).
- Add lazy-loaded routes inside the existing `<Routes>`:
  - `/games` → `GameHub`
  - `/games/bunny` → `BunnyJumper`
  - `/games/meteor` → `MeteorGlider`
  - `/games/mushroom` → `MushroomAdventure`
- Each game's `onExit` prop navigates back to `/games`.
- Games render inside the standard AppLayout (sidebar stays visible); the
  fixed-size canvas sits centered in the main content area, consistent with
  every other route.

## Hub redesign (the one creative piece)

Rebuild `GameHub` with the macOS HIG / DaisyUI card style already used across
Ollie Reader:

- Page header: `text-3xl font-semibold tracking-tight`.
- Responsive grid of three glass cards
  (`rounded-[10px] border border-border-hairline shadow-sm`, optional
  `backdrop-blur-xl`), each with title, blurb, a best-score line read from the
  existing `localStorage` keys, and a `btn-primary` 「開始遊戲」 action.
- Replace the source's `onPlayBunny/onPlayMeteor/onPlayMushroom` callback props
  with `useNavigate()` to the sub-routes.

## Port adaptations (mechanical risk)

- Rewrite `@/lib/...` → relative `./lib/...` in the 3 game files.
- Run `npm run build` (tsc strict) and fix any strict-mode type errors that the
  source's `tsc -b --noCheck` build hid.
- In-game menu / pause / back chrome (HTML overlays inside each game) is kept
  visually as-is; only verified to render under the web app's Tailwind v4. No
  custom tokens are used, so this is low risk.

## Persistence — unchanged

Best scores stay in `localStorage` under the existing keys:
`bunnyJumperBestScore`, `meteor-glider-best`, `mushroom-adventure-best`. No
Firebase work.

## Verification

No test runner exists in this repo, so:

- `npm run build` clean (type-check + production build).
- `npm run lint` clean.
- Manual smoke in `npm run dev`: sidebar 「小遊戲」 → hub renders three cards →
  each game launches, is playable, persists best score, and 返回 returns to the
  hub.

## Out of scope

Cloud / Firebase score sync, leaderboards, new games, restyling canvas
internals, audio, and any change to the existing 精靈探險 (`/game`) section.
