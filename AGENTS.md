# Repository Guidelines for Agents

<last_updated>2026-01-21</last_updated>

## Project Overview

**Ollie Reader** is a React + TypeScript + Vite web application for English learning. It uses Firebase (Auth, Firestore, Storage) and Gemini AI.

## Tech Stack

- **React 19** + React Router + TypeScript (strict)
- **Vite** + **Tailwind CSS v4** + **DaisyUI**
- **Framer Motion** for animations
- **Firebase** (Auth, Firestore, Storage)
- **Gemini AI** for content generation

---

## Design System (macOS HIG for Web)

Follow **macOS Human Interface Guidelines** adapted for responsive web:
> https://developer.apple.com/design/human-interface-guidelines

### Core Principles

1. **Glass Effect is Subtle** — Use `backdrop-blur` only for floating layers (Header, Sidebar, Modals). Main content stays solid.
2. **Hairline Borders** — Define structure with 1px low-opacity borders (`border-black/5` or `border-white/10`). Avoid thick borders.
3. **Visual Hierarchy** — Primary actions use accent color; secondary actions use subtle backgrounds with shadows.
4. **Mobile First** — Design for touch first, enhance for desktop hover states. Touch targets min 44px.

### Color Tokens (OKLCH)

Use OKLCH color space for perceptual uniformity.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `oklch(0.985 0 0)` | `oklch(0.13 0 0)` | App background |
| `--sidebar-bg` | `oklch(0.97 0 0 / 90%)` | `oklch(0.15 0 0 / 90%)` | Sidebar (translucent) |
| `--card` | `oklch(1 0 0 / 70%)` | `oklch(0.18 0 0 / 70%)` | Glass card surfaces |
| `--accent` | `oklch(0.6 0.2 250)` | `oklch(0.65 0.22 250)` | macOS Blue |
| `--border-hairline` | `oklch(0 0 0 / 8%)` | `oklch(1 0 0 / 8%)` | Subtle borders |
| `--destructive` | `oklch(0.577 0.245 27.325)` | — | macOS Red |
| `--success` | `oklch(0.65 0.2 145)` | — | macOS Green |

### Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Buttons, inputs |
| `--radius-md` | `8px` | Small cards |
| `--radius-lg` | `10px` | Standard cards, sidebar items |
| `--radius-xl` | `12px` | Popovers, dropdowns |
| `--radius-2xl` | `16px` | Modals, sheets |

### Glass & Shadow

```css
.glass {
  background: var(--card);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-hairline);
}
```

- `shadow-sm` — UI elements
- `shadow-lg` — Cards, modals (elevated)
- `shadow-xl` — Popovers, tooltips (floating)

### Layout Patterns

**Desktop (`lg+`):**
```
┌─────────────┬────────────────────────────────────┐
│   SIDEBAR   │  Header (sticky, blur)             │
│  (~260px)   ├────────────────────────────────────│
│             │  Main Content (scrollable)         │
└─────────────┴────────────────────────────────────┘
```

**Mobile (`< lg`):** Sidebar hidden → hamburger menu (Sheet/Drawer). Full-width stacked content.

**Header/Toolbar:** `h-12`, `bg-background/80 backdrop-blur-md border-b border-hairline`

### Component Guidelines (DaisyUI)

**Buttons:**
| Variant | Usage |
|---------|-------|
| `btn-primary` | Primary action (accent filled) |
| `btn-ghost` | Toolbar icons, sidebar items |
| `btn-outline` | Secondary actions |
| `btn-error` | Destructive actions |

**Inputs:** `input input-bordered` with focus ring, glass-like `bg-background/50`

**Cards:** `card` with `rounded-lg border border-hairline shadow-sm`, optional `backdrop-blur-xl`

**Modals/Drawers:** Overlay `bg-black/20 backdrop-blur-sm`, content `bg-background/90 backdrop-blur-2xl rounded-2xl`

### Interaction States

| State | Style |
|-------|-------|
| Hover | `hover:bg-black/5` (light) or `hover:bg-white/10` (dark) |
| Active | `active:scale-[0.98] active:opacity-90` |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` |

### Animation

- Default: `transition-all duration-200`
- Modal entry: `animate-in fade-in zoom-in-95`
- Respect `prefers-reduced-motion`

### Typography

System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

| Element | Style |
|---------|-------|
| Page title | `text-3xl font-semibold tracking-tight` |
| Section header | `text-xl font-semibold` |
| Body | `text-base` |
| Secondary | `text-sm text-muted-foreground` |

### Icons

Use `lucide-react`. Stroke width `1.5px`–`2px`. Size `16px`–`20px`.

---

## Architecture Principles

### State Management
- **Context API** for global state (Auth, PDF, Speech, Settings)
- **Custom Hooks** encapsulate business logic in `src/hooks/`

### Code Organization
```
src/
├── components/   # React UI components (by feature)
├── contexts/     # React Context providers
├── hooks/        # Custom React hooks
├── services/     # Firebase & API services
├── types/        # TypeScript definitions
├── utils/        # Utility functions
└── constants/    # API endpoints, config
```

### Performance Rules
- **No global loading state for single-item updates** — prevents full re-renders
- **Lazy code splitting** — all routes use `React.lazy`
- **IntersectionObserver** for infinite scroll (not scroll events)
- **AbortController** for async cleanup in hooks

---

## Code Style & Conventions

- **TypeScript strict** — define types in `src/types/`
- **Functional components** only
- **File naming** — Components: `PascalCase.tsx`, Hooks: `useName.ts`, Utils: `camelCase.ts`
- **Tailwind utilities** — avoid inline styles
- **Logging** — use `logger` from `src/utils/logger.ts`
- **2-space indentation**

---

## Build & Development

```bash
npm install        # Install dependencies
npm run dev        # Dev server at localhost:5173
npm run build      # Type-check + production build
npm run lint       # ESLint check
```

---

## Commit Guidelines

Use **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `chore:`

- Focused commits (one logical change)
- 72-character summary, imperative mood
- Never commit secrets (`.env.local`)
