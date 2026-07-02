# Wonder Academy Entry Reset Safeguards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wonder Academy's start/reset entry points match the canonical spec by nudging guests to sign in, clearly labeling guest demo saves, and requiring confirmation before overwriting existing progress.

**Architecture:** Add a small pure guard helper for entry CTA copy and overwrite-confirm decisions, with Vitest coverage. Wire `WonderAcademyCollector.tsx` to show a guest notice, sign-in primary action, guest demo secondary action, and an in-app reset confirmation from the hub.

**Tech Stack:** React 19, TypeScript strict, Vitest, Firebase Auth context, inline Wonder Academy styles.

---

## File Structure

- **Create** `src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.ts`
  - Pure helper functions for start-entry labels, guest warning copy, and reset confirmation decisions.
- **Create** `src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts`
  - Unit tests for guest/signed-in entry states and overwrite confirmation.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Use auth sign-in action, render guest demo warning, add guest demo button, add hub reset button, and add in-app reset confirmation panel.

## Task 1: Pure Guard Rules

- [x] **Step 1: Write failing tests**

Create guard tests that expect guests to see login-first copy plus a guest demo option, signed-in users to see normal start copy, and existing team progress to require overwrite confirmation.

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts`
Expected: fail because `wonderAcademySessionGuards.ts` does not exist.

- [x] **Step 3: Implement guard helper**

Create `wonderAcademySessionGuards.ts` with `getWonderAcademyEntryCopy()` and `shouldConfirmWonderAcademyOverwrite()`.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts`
Expected: pass.

## Task 2: Wire Title And Reset UI

- [x] **Step 1: Modify auth usage**

Destructure `signInWithGoogle` and `authError` from `useAuth()` in `WonderAcademyCollector.tsx`.

- [x] **Step 2: Add title entry actions**

Use guard copy to render a guest warning, a primary sign-in button, and a secondary guest demo button. Signed-in users keep the normal start button.

- [x] **Step 3: Add hub reset confirmation**

Add a hub `重新開始` button that opens an in-app confirmation panel. Confirming dispatches a reset action that starts a clean new game; canceling preserves current progress.

- [x] **Step 4: Verify targeted tests and build**

Run: `npm run test -- src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts`
Run: `npm run build`
Expected: both pass.

## Task 3: Browser Smoke And Commit

- [x] **Step 1: Browser smoke on existing dev server**

Use the already-running `http://localhost:5173/games/wonder-academy`. Verify guest title copy, guest demo progression, and reset confirmation panel.

- [x] **Step 2: Full automated checks**

Run: `npm run lint`
Run: `npm run test`
Run: `npm run build`
Expected: lint has no errors; tests/build pass.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-entry-reset-safeguards.md \
  src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.ts \
  src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): guard guest starts and resets"
```
