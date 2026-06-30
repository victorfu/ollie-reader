# Wonder Academy Local Cache Requeue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When loading a signed-in Wonder Academy save, immediately queue newer local cache progress for cloud sync.

**Architecture:** `loadWonderAcademySave()` already chooses the freshest record across cloud, pending, and local cache. If the selected record is local or legacy-local and cloud load succeeded, write that selected local data into the pending queue before returning. This keeps localStorage as cache plus pending queue, and makes `syncWonderAcademyPendingSave()` able to flush the selected local progress without relying on the UI autosave timer.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence helpers.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add expectations that selected local cache records are queued as pending.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Queue selected local/legacy-local records as pending when cloud did not fail.

## Task 1: Requeue Selected Local Cache

- [x] **Step 1: Write failing tests**

Update the existing "marks a newer local cache as unsynced when cloud is older" test to assert:

```ts
expect(readWonderAcademyPending(uid)).toMatchObject({
  updatedAt: 300,
  data: sample({ playerName: "Local" }),
});
```

Add a second test:

```ts
it("queues local cache as pending when cloud has no save", async () => {
  const cloud = cloudAdapter();
  writeWonderAcademyCache(uid, sample({ playerName: "Local only" }), 300);
  vi.mocked(cloud.load).mockResolvedValue(null);

  const loaded = await loadWonderAcademySave({ uid, cloud });

  expect(loaded).toMatchObject({
    source: "local",
    status: "pending",
    hasUnsyncedLocalProgress: true,
  });
  expect(readWonderAcademyPending(uid)).toMatchObject({
    updatedAt: 300,
    data: sample({ playerName: "Local only" }),
  });
});
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because selected local cache is not written to the pending queue during load.

- [x] **Step 3: Implement requeue**

In `loadWonderAcademySave()`, after computing `hasUnsyncedLocalProgress`, write:

```ts
if (hasUnsyncedLocalProgress && selected.source !== "pending") {
  writeWonderAcademyPending(uid, selected.data, selected.updatedAt, storage);
}
```

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
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
git add docs/superpowers/plans/2026-06-30-wonder-academy-local-cache-requeue.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): queue unsynced local saves on load"
```
