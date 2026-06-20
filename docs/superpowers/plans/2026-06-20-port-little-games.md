# Port Ollie Little Games — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the three canvas mini-games from `ollie-little-games` into Ollie Reader as a new 「小遊戲」 section reachable from the sidebar.

**Architecture:** Copy the self-contained game sources into `src/components/LittleGames/` (game logic helpers in a local `lib/` subfolder), author a redesigned design-system hub page, and wire a `/games` hub route plus three sub-routes into the existing `AppContent` router and sidebar. Best scores stay in `localStorage` (unchanged keys). No Firebase, no new deps.

**Tech Stack:** React 19, react-router-dom v7, TypeScript (strict), Vite, Tailwind v4 + DaisyUI, lucide-react.

## Global Constraints

- **No `@/` path alias exists** in this repo — all intra-module imports must be relative (e.g. `./lib/constants`).
- **TS strict + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch`** are on; the source built with `tsc --noCheck`, so ported files may need fixes to compile.
- **Verification = `npm run build` + `npm run lint`** (this repo has no test runner) plus manual smoke; both build and lint must be clean before each commit.
- **Keep existing localStorage keys verbatim:** `bunnyJumperBestScore`, `meteor-glider-best`, `mushroom-adventure-best`.
- **Do not modify** the existing `src/components/Game/` (精靈探險, `/game`) section.
- **Design tokens** available: `bg-card`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border-hairline`, `bg-accent-tint`, `text-accent`, DaisyUI `btn btn-primary`.
- 2-space indentation; Conventional Commits.

Source repo (read-only): `/Users/victor/Documents/ollie-little-games`

---

### Task 1: Scaffold the LittleGames module (copy games + helpers, fix imports, compile)

**Files:**
- Create: `src/components/LittleGames/BunnyJumper.tsx` (copied)
- Create: `src/components/LittleGames/MeteorGlider.tsx` (copied)
- Create: `src/components/LittleGames/MushroomAdventure.tsx` (copied)
- Create: `src/components/LittleGames/lib/constants.ts` (copied)
- Create: `src/components/LittleGames/lib/types.ts` (copied)
- Create: `src/components/LittleGames/lib/game-utils.ts` (copied)
- Create: `src/components/LittleGames/lib/game-objects.ts` (copied)

**Interfaces:**
- Produces: default exports `BunnyJumper(props: { onExit?: () => void })`, `MeteorGlider(props: { onExit?: () => void; onPlayBunny?: () => void })`, `MushroomAdventure(props: { onExit?: () => void })`. Helper `getBestScore(): number` from `./lib/game-utils` (reads `bunnyJumperBestScore`). Task 2 and Task 3 rely on these signatures.

- [ ] **Step 1: Copy the game components and helper lib from the source repo**

Run (from the worktree root):

```bash
SRC=/Users/victor/Documents/ollie-little-games/src
DEST=src/components/LittleGames
mkdir -p "$DEST/lib"
cp "$SRC/components/BunnyJumper.tsx"       "$DEST/BunnyJumper.tsx"
cp "$SRC/components/MeteorGlider.tsx"      "$DEST/MeteorGlider.tsx"
cp "$SRC/components/MushroomAdventure.tsx" "$DEST/MushroomAdventure.tsx"
cp "$SRC/lib/constants.ts"   "$DEST/lib/constants.ts"
cp "$SRC/lib/types.ts"       "$DEST/lib/types.ts"
cp "$SRC/lib/game-utils.ts"  "$DEST/lib/game-utils.ts"
cp "$SRC/lib/game-objects.ts" "$DEST/lib/game-objects.ts"
```

Do **not** copy `GameHub.tsx` (a redesigned one is authored in Task 2) and do **not** copy `spirits/` (unused by these games).

- [ ] **Step 2: Rewrite `@/lib/` imports to relative `./lib/`**

The copied game components import from `@/lib/...`, which has no alias here. Rewrite them (macOS `sed` requires the `-i ''` form):

```bash
DEST=src/components/LittleGames
sed -i '' 's#@/lib/#./lib/#g' \
  "$DEST/BunnyJumper.tsx" "$DEST/MeteorGlider.tsx" "$DEST/MushroomAdventure.tsx"
```

- [ ] **Step 3: Verify no `@/` imports remain**

Run:

```bash
grep -rn '@/' src/components/LittleGames || echo "OK: no @/ imports remain"
```

Expected: `OK: no @/ imports remain` (the lib files have no `@/` imports of their own).

- [ ] **Step 4: Type-check + production build, fixing strict-mode errors iteratively**

Run:

```bash
npm run build
```

Expected on first run: possibly FAIL with TypeScript errors, because the source compiled with `--noCheck`. Fix each error in the copied files using the matching pattern, then re-run `npm run build` until it passes clean:

- `TS6133: 'x' is declared but its value is never read` → remove the unused import/variable. If it is a function **parameter** that must stay for arity, rename it to `_x`.
- `TS7006: Parameter 'p' implicitly has an 'any' type` → add an explicit type (the neighbouring code/types in `./lib/types` show the intended shape).
- `TS7027 / TS7029` (unreachable / fallthrough case) → add the missing `break;` or a `// falls through` comment only if the fallthrough is intentional.
- Any other strict error → make the minimal, behaviour-preserving fix.

Do not change game logic — only satisfy the type checker. Re-run until:

Expected final: build completes with no errors (Vite emits the bundle).

- [ ] **Step 5: Lint the new module**

Run:

```bash
npm run lint
```

Expected: PASS. Fix any errors the linter reports in `src/components/LittleGames/**` (e.g. unused vars the linter flags that tsc did not). Warnings that the existing repo also emits are acceptable; errors are not.

- [ ] **Step 6: Commit**

```bash
git add src/components/LittleGames
git commit -m "feat(games): port little-games components and helpers into web app"
```

---

### Task 2: Author the redesigned GameHub

**Files:**
- Create: `src/components/LittleGames/GameHub.tsx`

**Interfaces:**
- Consumes: `getBestScore` from `./lib/game-utils` (Task 1).
- Produces: default export `GameHub()` — takes **no props**, uses `useNavigate()` internally to route to `/games/bunny`, `/games/meteor`, `/games/mushroom`. Task 3 lazy-loads this as the `/games` element.

- [ ] **Step 1: Write `src/components/LittleGames/GameHub.tsx`**

Full file content:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBestScore } from "./lib/game-utils";

const METEOR_BEST_KEY = "meteor-glider-best";
const MUSHROOM_BEST_KEY = "mushroom-adventure-best";

type GameCard = {
  id: "bunny" | "meteor" | "mushroom";
  to: string;
  title: string;
  blurb: string;
  tag: string;
  emoji: string;
  best: number | null;
};

function readBest(key: string): number | null {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  const parsed = parseInt(stored, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function GameHub() {
  const navigate = useNavigate();
  const [bunnyBest, setBunnyBest] = useState<number | null>(null);
  const [meteorBest, setMeteorBest] = useState<number | null>(null);
  const [mushroomBest, setMushroomBest] = useState<number | null>(null);

  useEffect(() => {
    setBunnyBest(getBestScore());
    setMeteorBest(readBest(METEOR_BEST_KEY));
    setMushroomBest(readBest(MUSHROOM_BEST_KEY));
  }, []);

  const cards: GameCard[] = useMemo(
    () => [
      {
        id: "bunny",
        to: "/games/bunny",
        title: "Bunny Jumper",
        blurb: "在粉彩天空中不斷彈跳，收集胡蘿蔔、衝高連段分數。",
        tag: "Arcade",
        emoji: "🐰",
        best: bunnyBest,
      },
      {
        id: "mushroom",
        to: "/games/mushroom",
        title: "森林蘑菇冒險",
        blurb: "像馬力歐的闖關平台：踩蘑菇怪、收集硬幣、衝向旗桿。",
        tag: "Platformer",
        emoji: "🍄",
        best: mushroomBest,
      },
      {
        id: "meteor",
        to: "/games/meteor",
        title: "Meteor Glider",
        blurb: "駕駛滑翔機穿越隕石雨，衝刺鑽過縫隙、收集燃料電池。",
        tag: "Arcade",
        emoji: "☄️",
        best: meteorBest,
      },
    ],
    [bunnyBest, meteorBest, mushroomBest],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Ollie Little Games
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">小遊戲</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          一些瀏覽器大小的小冒險，點開即玩，免安裝。
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.id}
            className="group flex flex-col rounded-[10px] border border-border-hairline bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl" aria-hidden="true">
                {card.emoji}
              </span>
              <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent">
                {card.tag}
              </span>
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">
              {card.title}
            </h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {card.blurb}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {card.best && card.best > 0 ? `最高分 ${card.best}` : "尚無紀錄"}
              </span>
              <button
                type="button"
                onClick={() => navigate(card.to)}
                className="btn btn-primary btn-sm rounded-[6px]"
              >
                開始遊戲
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint**

Run:

```bash
npm run build && npm run lint
```

Expected: both PASS. (`GameHub` is not yet referenced by any route — that is fine; tsc still type-checks it.)

- [ ] **Step 3: Commit**

```bash
git add src/components/LittleGames/GameHub.tsx
git commit -m "feat(games): add design-system game hub for little games"
```

---

### Task 3: Wire routes and sidebar entry into App.tsx

**Files:**
- Modify: `src/App.tsx` (react-router import ~line 2-8; lucide import ~line 9-24; lazy block ~line 56-66; `AppContent` ~line 114; `navItems` ~line 192; routes ~line 486)

**Interfaces:**
- Consumes: default exports from Task 1 (`BunnyJumper`, `MeteorGlider`, `MushroomAdventure`) and Task 2 (`GameHub`).

- [ ] **Step 1: Add `useNavigate` to the react-router-dom import**

In `src/App.tsx`, change:

```tsx
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
```

to:

```tsx
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
```

- [ ] **Step 2: Add the `Joystick` icon to the lucide-react import**

Change the line:

```tsx
  Gamepad2,
```

to:

```tsx
  Gamepad2,
  Joystick,
```

- [ ] **Step 3: Add the lazy route imports**

After the existing lazy declaration for `TravelEnglishPage` (the lazy block that ends around line 66), add:

```tsx
const LittleGamesHub = lazy(() => import("./components/LittleGames/GameHub"));
const BunnyJumper = lazy(() => import("./components/LittleGames/BunnyJumper"));
const MeteorGlider = lazy(
  () => import("./components/LittleGames/MeteorGlider"),
);
const MushroomAdventure = lazy(
  () => import("./components/LittleGames/MushroomAdventure"),
);
```

- [ ] **Step 4: Get a `navigate` handle inside `AppContent`**

In `AppContent` (function at line 112), directly after:

```tsx
  const location = useLocation();
```

add:

```tsx
  const navigate = useNavigate();
```

- [ ] **Step 5: Add the sidebar nav entry**

In the `navItems` array, change:

```tsx
    { to: "/game", label: "精靈探險", icon: Gamepad2 },
```

to:

```tsx
    { to: "/game", label: "精靈探險", icon: Gamepad2 },
    { to: "/games", label: "小遊戲", icon: Joystick },
```

- [ ] **Step 6: Add the routes**

In the `<Routes>` block, change:

```tsx
                      <Route path="/game" element={<SpiritAdventure />} />
```

to:

```tsx
                      <Route path="/game" element={<SpiritAdventure />} />
                      <Route path="/games" element={<LittleGamesHub />} />
                      <Route
                        path="/games/bunny"
                        element={<BunnyJumper onExit={() => navigate("/games")} />}
                      />
                      <Route
                        path="/games/meteor"
                        element={
                          <MeteorGlider
                            onExit={() => navigate("/games")}
                            onPlayBunny={() => navigate("/games/bunny")}
                          />
                        }
                      />
                      <Route
                        path="/games/mushroom"
                        element={
                          <MushroomAdventure onExit={() => navigate("/games")} />
                        }
                      />
```

- [ ] **Step 7: Build + lint**

Run:

```bash
npm run build && npm run lint
```

Expected: both PASS clean.

- [ ] **Step 8: Manual smoke test**

Run:

```bash
npm run dev
```

Then in the browser (http://localhost:5173), signed in:
1. Confirm the sidebar shows 「小遊戲」 with the Joystick icon, below 「精靈探險」.
2. Click it → the redesigned hub renders three cards (Bunny Jumper, 森林蘑菇冒險, Meteor Glider), each showing 最高分 / 尚無紀錄 and an 開始遊戲 button.
3. Open each game: it loads, is playable with keyboard, and 返回 / exit returns to `/games`.
4. Play once, exit, and reopen the hub → the best score for that game updates (localStorage persists).

> Note: Firebase App Check can block headless/sandboxed rendering (known repo quirk), so this step is run by a human or in a real browser session; the authoritative automated gate remains `npm run build` + `npm run lint`.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat(games): add /games hub and sidebar entry for little games"
```

---

## Self-Review

**Spec coverage:**
- Self-contained copy-in module → Task 1. ✅
- File layout `LittleGames/` + `lib/`, no `spirits/` → Task 1. ✅
- `@/lib` → relative rewrite, strict-mode fixes → Task 1 (Steps 2, 4). ✅
- Redesigned hub matching design system → Task 2. ✅
- Single 「小遊戲」 sidebar entry + `/games` hub + three sub-routes → Task 3 (Steps 5, 6). ✅
- `onExit` back to `/games`; MeteorGlider `onPlayBunny` → `/games/bunny` → Task 3 (Step 6). ✅
- localStorage persistence unchanged (keys verbatim) → Task 1 copies game-utils as-is; hub reads same keys (Task 2). ✅
- Verification build + lint + manual → every task. ✅
- Don't touch existing `/game` 精靈探險 → no task modifies `src/components/Game/`. ✅

**Placeholder scan:** No TBD/TODO. The only iterative step (Task 1 Step 4) lists concrete fix patterns with exact error codes — acceptable because exact compiler output of a `--noCheck` port is unknowable until run.

**Type consistency:** Game prop signatures in Task 1's Interfaces (`onExit?`, `onPlayBunny?`) match exactly how Task 3 Step 6 invokes them. `GameHub` is propless in both Task 2 and Task 3. `getBestScore(): number` consumed by Task 2 matches Task 1's produced helper.
