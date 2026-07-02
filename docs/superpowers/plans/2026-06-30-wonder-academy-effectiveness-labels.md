# Wonder Academy Effectiveness Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Wonder Academy battle move effectiveness hints with the canonical spec text: `剋制 2x / 不利 0.5x`.

**Architecture:** Add a tiny pure UI-text helper beside the type chart logic. The React battle screen consumes the helper instead of hardcoding separate JSX conditions, keeping the user-visible label testable without needing to drive a battle in the browser.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy battle UI and type chart modules.

---

## File Structure

- **Create** `src/components/LittleGames/wonder-academy/logic/battleText.ts`
  - Export `effectivenessBadge(effectiveness)` returning a label/theme pair or `null`.
- **Create** `src/components/LittleGames/wonder-academy/logic/battleText.test.ts`
  - Test strong, resisted, and neutral labels.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Import `effectivenessBadge`.
  - Render a single badge using the helper result.

## Task 1: Effectiveness Badge Helper

- [x] **Step 1: Write failing test**

Create `src/components/LittleGames/wonder-academy/logic/battleText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { effectivenessBadge } from "./battleText";

describe("effectivenessBadge", () => {
  it("labels super effective moves with the spec wording", () => {
    expect(effectivenessBadge(2)).toEqual({ label: "剋制 2x", tone: "strong" });
  });

  it("labels resisted moves with the spec wording", () => {
    expect(effectivenessBadge(0.5)).toEqual({ label: "不利 0.5x", tone: "weak" });
  });

  it("hides neutral effectiveness", () => {
    expect(effectivenessBadge(1)).toBeNull();
  });
});
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/battleText.test.ts
```

Expected: fail because `battleText.ts` does not exist yet.

- [x] **Step 3: Implement helper**

Create `src/components/LittleGames/wonder-academy/logic/battleText.ts`:

```ts
export type EffectivenessBadge = {
  label: string;
  tone: "strong" | "weak";
};

export function effectivenessBadge(effectiveness: number): EffectivenessBadge | null {
  if (effectiveness >= 2) return { label: "剋制 2x", tone: "strong" };
  if (effectiveness <= 0.5) return { label: "不利 0.5x", tone: "weak" };
  return null;
}
```

- [x] **Step 4: Wire battle UI**

In `WonderAcademyCollector.tsx`, import `effectivenessBadge`, calculate `const badge = effectivenessBadge(eff);`, and render:

```tsx
{badge && (
  <span style={badge.tone === "weak" ? { ...effBadge, background: "#9aa0b5" } : effBadge}>
    {badge.label}
  </span>
)}
```

- [x] **Step 5: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/logic/battleText.test.ts
```

Expected: pass.

## Task 2: Full Verification And Commit

- [x] **Step 1: Run full checks**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected: lint has no errors; tests and build pass. Existing non-blocking warnings can remain documented.

- [x] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-effectiveness-labels.md \
  src/components/LittleGames/wonder-academy/logic/battleText.ts \
  src/components/LittleGames/wonder-academy/logic/battleText.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "fix(wonder-academy): align battle effectiveness labels"
```
