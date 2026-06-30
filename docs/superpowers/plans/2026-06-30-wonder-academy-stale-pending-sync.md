# Wonder Academy Stale Pending Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stale Wonder Academy pending saves from overwriting newer cloud progress.

**Architecture:** Before flushing a pending save, `syncWonderAcademyPendingSave()` checks the current cloud record. If cloud is newer or equal, cloud wins: refresh the local cache from cloud, clear the stale pending queue, and report saved status using the cloud timestamp. If cloud is absent or older, keep the existing pending-to-cloud save path.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy persistence adapter.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts`
  - Add a regression test for stale pending queue conflict.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts`
  - Check cloud before saving pending data.

## Task 1: Stale Pending Guard

- [x] **Step 1: Write failing test**

Add to `describe("syncWonderAcademyPendingSave")`:

```ts
it("does not overwrite newer cloud saves with stale pending data", async () => {
  const cloud = cloudAdapter();
  writeWonderAcademyPending(uid, sample({ playerName: "Old pending" }), 900);
  vi.mocked(cloud.load).mockResolvedValue({
    schemaVersion: 2,
    updatedAt: 1000,
    data: sample({ playerName: "New cloud" }),
  });

  const result = await syncWonderAcademyPendingSave({ uid, cloud });

  expect(result).toEqual({ status: "saved", updatedAt: 1000 });
  expect(cloud.save).not.toHaveBeenCalled();
  expect(readWonderAcademyCache(uid)?.data.playerName).toBe("New cloud");
  expect(readWonderAcademyPending(uid)).toBeNull();
});
```

- [x] **Step 2: Verify test fails**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
```

Expected: fail because `syncWonderAcademyPendingSave()` currently writes stale pending data without checking cloud.

- [x] **Step 3: Implement stale pending guard**

In `syncWonderAcademyPendingSave()`, before constructing/saving the pending record:

```ts
const cloudRecord = await cloud.load(uid);
if (cloudRecord && cloudRecord.updatedAt >= pending.updatedAt) {
  writeWonderAcademyCache(uid, cloudRecord.data, cloudRecord.updatedAt, storage);
  clearWonderAcademyPending(uid, storage);
  return { status: "saved", updatedAt: cloudRecord.updatedAt };
}
```

Keep the existing catch behavior so network/load failures leave pending queued.

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
git add docs/superpowers/plans/2026-06-30-wonder-academy-stale-pending-sync.md \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyPersistence.test.ts
git commit -m "fix(wonder-academy): avoid stale pending overwrites"
```
