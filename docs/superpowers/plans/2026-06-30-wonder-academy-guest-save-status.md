# Wonder Academy Guest Save Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent guest Wonder Academy sessions from showing cloud-sync pending status for local-only saves.

**Architecture:** Add a pure session guard helper that maps persistence status to the visible save status. Guest sessions are local-only, so non-saving guest states should display as `saved`/本機保存; signed-in sessions keep the raw persistence status.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy session guard helpers.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts`
  - Add tests for guest and signed-in save status mapping.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.ts`
  - Export `visibleWonderAcademySaveStatus()`.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Use `visibleWonderAcademySaveStatus()` when applying load results.

## Task 1: Visible Save Status Mapping

- [x] **Step 1: Write failing tests**

Add tests:

```ts
describe("visibleWonderAcademySaveStatus", () => {
  it("maps guest local/pending states to saved", () => {
    expect(visibleWonderAcademySaveStatus({ isGuest: true, status: "idle" })).toBe("saved");
    expect(visibleWonderAcademySaveStatus({ isGuest: true, status: "pending" })).toBe("saved");
  });

  it("keeps guest saving and failed states explicit", () => {
    expect(visibleWonderAcademySaveStatus({ isGuest: true, status: "saving" })).toBe("saving");
    expect(visibleWonderAcademySaveStatus({ isGuest: true, status: "failed" })).toBe("failed");
  });

  it("does not rewrite signed-in save states", () => {
    expect(visibleWonderAcademySaveStatus({ isGuest: false, status: "pending" })).toBe("pending");
    expect(visibleWonderAcademySaveStatus({ isGuest: false, status: "saved" })).toBe("saved");
  });
});
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts
```

Expected: fail because `visibleWonderAcademySaveStatus()` does not exist yet.

- [x] **Step 3: Implement helper and wire load effect**

Add the helper and replace the load effect's inline guest `idle` mapping with:

```ts
status: visibleWonderAcademySaveStatus({ isGuest, status: result.status }),
```

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-guest-save-status.md \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx \
  src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.ts \
  src/components/LittleGames/wonder-academy/wonderAcademySessionGuards.test.ts
git commit -m "fix(wonder-academy): show guest saves as local"
```
