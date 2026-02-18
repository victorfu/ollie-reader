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

### Web Application Environment

This is a standard responsive Web Application running in browser environments (Chrome, Safari, Edge) across devices from mobile phones to large desktop monitors.

| Aspect | Description |
|--------|-------------|
| **Display** | Variable viewport sizes. Browser UI (address bar, tabs) present. Layout handles resizing fluidly. |
| **Input** | Hybrid: Mouse/Trackpad (Desktop) and Touch (Mobile/Tablet). Hover states for desktop; touch targets min 44px on mobile. |
| **Navigation** | Desktop: Sidebar (Source List) or Top Navigation. Mobile: Hamburger Menu (Sheet) or Bottom Tab Bar. |
| **Layout** | Desktop: "Window" feel with translucent sidebars and scrolling content. Mobile: Full-width stacked content with slide-over navigation. |
| **Responsiveness** | Mobile First. Breakpoints (`sm`, `md`, `lg`, `xl`) trigger layout shifts (e.g., Sidebar collapses to Drawer). |

### Core Principles

1. **Glass Effect is Subtle** — Use `backdrop-blur` only for floating layers (Header, Sidebar, Modals). Main content stays solid.
2. **Hairline Borders** — Define structure with 1px low-opacity borders (`border-black/5` or `border-white/10`). Avoid thick borders.
3. **Visual Hierarchy** — Primary actions use accent color; secondary actions use subtle backgrounds with shadows.
4. **Mobile First** — Design for touch first, enhance for desktop hover states. Touch targets min 44px.

### Design Token System

#### File Structure

```
src/styles/
├── tokens.css      # Raw design tokens (animations, radii, shadows, glass)
└── base.css        # Theme definitions + Tailwind @theme mapping
```

Import tokens via:

```css
@import "tailwindcss";
@import "./tokens.css";
```

#### Color Tokens (OKLCH)

Use OKLCH color space for perceptual uniformity.

**Light Theme (`:root`):**

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.985 0 0)` | App background |
| `--sidebar-bg` | `oklch(0.97 0 0 / 90%)` | Sidebar background (translucent) |
| `--card` | `oklch(1 0 0 / 70%)` | Glass card surfaces |
| `--accent` | `oklch(0.6 0.2 250)` | macOS Blue |
| `--accent-tint` | `oklch(0.6 0.2 250 / 10%)` | Subtle accent background |
| `--border-hairline` | `oklch(0 0 0 / 8%)` | Subtle borders (separators) |
| `--destructive` | `oklch(0.577 0.245 27.325)` | macOS Red |
| `--success` | `oklch(0.65 0.2 145)` | macOS Green |

**Dark Theme (`.dark`):**

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.13 0 0)` | Deep gray background |
| `--sidebar-bg` | `oklch(0.15 0 0 / 90%)` | Sidebar background |
| `--card` | `oklch(0.18 0 0 / 70%)` | Glass card surfaces |
| `--accent` | `oklch(0.65 0.22 250)` | Brighter blue for dark mode |
| `--border-hairline` | `oklch(1 0 0 / 8%)` | Inverted subtle borders |

#### Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Buttons, inputs (Controls) |
| `--radius-md` | `8px` | Small cards |
| `--radius-lg` | `10px` | Standard cards, sidebar items |
| `--radius-xl` | `12px` | Popovers, dropdowns |
| `--radius-2xl` | `16px` | Modals, sheets |
| `--radius-full` | `9999px` | Pills, avatars |

#### Glass & Shadow

**Glass Utility:**

```css
.glass {
  background: var(--glass-bg-medium);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-hairline);
}
```

**Shadows:**

- `shadow-sm` — UI elements
- `shadow-lg` (elevated) — Cards, modals
- `shadow-xl` (floating) — Popovers, tooltips

### Layout Patterns

#### Layout Structure (Desktop Default)

The app mimics the macOS "App Structure":

```
┌───────────────────┬─────────────────────────────────────────────────────┐
│                   │  [Breadcrumb/Title]              [Actions/User]     │
│                   │  ─────────────────────────────────────────────────  │ ← Toolbar / Header (Sticky)
│                   │                                                     │
│    SIDEBAR        │                                                     │
│  (Source List)    │                 MAIN CONTENT AREA                   │
│                   │                                                     │
│  • Navigation     │               (Scrollable View)                     │
│  • User Profile   │                                                     │
│                   │                                                     │
└───────────────────┴─────────────────────────────────────────────────────┘
```

#### Responsive Behavior

- **Desktop (`lg+`):** Persistent Sidebar (width ~260px) + Main Content.
- **Tablet (`md`):** Collapsible Sidebar or Icon Rail.
- **Mobile (`sm`):** Hidden Sidebar (accessed via Hamburger/Sheet) or Bottom Navigation.

#### AppLayout

```tsx
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar - Hidden on Mobile */}
      <aside className="hidden w-64 flex-col border-r border-border-hairline bg-sidebar lg:flex backdrop-blur-xl">
        {/* Sidebar Content */}
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Header / Toolbar */}
        <header className="flex h-12 items-center justify-between border-b border-border-hairline bg-background/80 px-4 backdrop-blur-md sticky top-0 z-10">
           {/* Mobile Menu Trigger, Breadcrumbs, Actions */}
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-5xl">
             {children}
          </div>
        </div>
      </main>
    </div>
  )
}
```

#### Toolbar / Header

- **Height:** `h-12` or `h-14`
- **Blur:** `bg-background/80 backdrop-blur-md`
- **Border:** `border-b border-border-hairline`
- **Content:**
  - Left: Mobile Toggle (if mobile) + Page Title / Breadcrumb
  - Center: Search (optional)
  - Right: Action Buttons + User Menu

#### Mobile Navigation

On screens smaller than `lg`, use a `<Sheet>` (Side drawer) triggered by a Hamburger menu icon. The Sheet content mimics the Desktop Sidebar.

### Component Guidelines (DaisyUI)

**Buttons:**

| Variant | Description |
|---------|-------------|
| `btn-primary` | Accent color filled button (Call to Action) |
| `btn-ghost` | Transparent with hover (Toolbar icons, Sidebar items) |
| `btn-outline` | Transparent with border (Secondary actions) |
| `btn-error` | Destructive actions |

**Base Button Styling:**

```
inline-flex items-center justify-center whitespace-nowrap rounded-[6px] text-sm font-medium
transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
disabled:pointer-events-none disabled:opacity-50
```

**Inputs:**

`input input-bordered` with focus ring, glass-like `bg-background/50`

```
rounded-[6px] border border-border-hairline bg-background/50 shadow-sm
focus-visible:ring-2 focus-visible:ring-accent
placeholder:text-muted-foreground
```

**Cards:**

`card` with `rounded-[10px] border border-border-hairline shadow-sm`, optional `backdrop-blur-xl`

**Sidebar Item:**

```
flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm font-medium transition-colors
hover:bg-accent/10 hover:text-accent-foreground
data-[active=true]:bg-accent data-[active=true]:text-white data-[active=true]:shadow-sm
```

**Switch / Toggle:**

- Track: `h-6 w-10` rounded-full
- Thumb: `size-5` white shadow-sm

**Modals / Drawers:**

- Overlay: `bg-black/20 backdrop-blur-sm` (Light) or `bg-black/40 backdrop-blur-md` (Dark)
- Content: `bg-background/90 backdrop-blur-2xl border border-border-hairline shadow-2xl rounded-[14px]`

### Interaction States

| State | Style |
|-------|-------|
| Hover | `hover:bg-black/5` (light) or `hover:bg-white/10` (dark) |
| Active | `active:scale-[0.98] active:opacity-90` |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` |

### Animation & Motion

**Motion Tokens:**

| Class | Description |
|-------|-------------|
| `transition-all duration-200 ease-decelerate` | Default interaction transition |
| `animate-in fade-in zoom-in-95` | Modals / Popovers opening |
| `animate-out fade-out zoom-out-95` | Modals / Popovers closing |
| `animate-slide-in-from-left` | Mobile Sheet entry |

Respect `prefers-reduced-motion`: wrap motion classes in `motion-safe:` or keep strictly decorative.

### Typography

System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

| Element | Style |
|---------|-------|
| Page title | `text-3xl font-semibold tracking-tight` |
| Section header | `text-xl font-semibold` |
| Body | `text-base` |
| Secondary | `text-sm text-muted-foreground` |
| Sidebar item | `text-sm font-medium` |
| Sidebar section label | `text-xs font-semibold text-muted-foreground/70` |

### Icons

Use `lucide-react`. Stroke width `1.5px`–`2px`. Size `16px` (sm) to `20px` (default).

### Implementation Guidelines

1. **Glass Effect is Subtle:** Don't overuse heavy blur. Use it for "floating" layers (Header, Sidebar, Modals, Tooltips). Main content background is usually solid.
2. **Border Hairlines:** macOS defines structure via 1px borders with low opacity. Avoid thick borders.
3. **Visual Hierarchy:**
   - Primary Actions: `bg-accent text-white`
   - Secondary Actions: `bg-background border shadow-sm`
   - Destructive: `text-destructive` (ghost) or `bg-destructive` (solid) for confirmations
4. **Responsive Handling:**
   - Always check layouts on standard breakpoints.
   - **Tables:** On mobile, consider converting to "Card Lists" if columns get squashed.

### Objective

> Build a **Responsive Web Application** that feels like a native macOS app. It should be fluid, clean, utilize translucent materials (glass), and respect the user's device capabilities (touch vs mouse).

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
