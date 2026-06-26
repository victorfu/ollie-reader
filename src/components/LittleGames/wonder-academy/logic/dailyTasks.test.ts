import { describe, expect, it } from "vitest";
import {
  bumpDaily,
  claimTask,
  DAILY_TASKS,
  emptyDaily,
  isClaimable,
  isComplete,
  rolloverDaily,
  taskDef,
} from "./dailyTasks";

const TODAY = "2026-6-26";
const YESTERDAY = "2026-6-25";

describe("dailyTasks", () => {
  it("defines three tasks with positive goals and rewards", () => {
    expect(DAILY_TASKS).toHaveLength(3);
    for (const t of DAILY_TASKS) {
      expect(t.goal).toBeGreaterThan(0);
      expect(t.stardust).toBeGreaterThan(0);
      expect(taskDef(t.id)).toBe(t);
    }
  });

  it("starts a clean day with zero counts", () => {
    const d = emptyDaily(TODAY);
    expect(d).toEqual({ date: TODAY, counts: { catch: 0, win: 0, chest: 0 }, claimed: [] });
  });

  it("rolls a stale or missing day over to a fresh one", () => {
    const stale = { date: YESTERDAY, counts: { catch: 1, win: 2, chest: 3 }, claimed: ["win" as const] };
    expect(rolloverDaily(stale, TODAY)).toEqual(emptyDaily(TODAY));
    expect(rolloverDaily(null, TODAY)).toEqual(emptyDaily(TODAY));
    // same day is kept as-is
    const fresh = emptyDaily(TODAY);
    expect(rolloverDaily(fresh, TODAY)).toBe(fresh);
  });

  it("bumps a task count and rolls the day over when stale", () => {
    const after = bumpDaily(null, "chest", TODAY);
    expect(after.counts.chest).toBe(1);
    expect(after.date).toBe(TODAY);

    const stale = bumpDaily({ date: YESTERDAY, counts: { catch: 5, win: 5, chest: 5 }, claimed: [] }, "win", TODAY);
    expect(stale.counts).toEqual({ catch: 0, win: 1, chest: 0 });
  });

  it("tracks completion and claimability", () => {
    let d = emptyDaily(TODAY);
    expect(isComplete(d, "win")).toBe(false);
    d = bumpDaily(d, "win", TODAY);
    expect(isComplete(d, "win")).toBe(false); // goal is 2
    d = bumpDaily(d, "win", TODAY);
    expect(isComplete(d, "win")).toBe(true);
    expect(isClaimable(d, "win")).toBe(true);
  });

  it("claims a finished task once, awarding its stardust", () => {
    let d = bumpDaily(emptyDaily(TODAY), "catch", TODAY); // catch goal is 1
    const res = claimTask(d, "catch", TODAY);
    expect(res).not.toBeNull();
    expect(res?.stardust).toBe(taskDef("catch").stardust);
    d = res!.progress;
    expect(d.claimed).toContain("catch");
    expect(isClaimable(d, "catch")).toBe(false);
    // claiming again is a no-op
    expect(claimTask(d, "catch", TODAY)).toBeNull();
  });

  it("refuses to claim an unfinished task", () => {
    const d = emptyDaily(TODAY);
    expect(claimTask(d, "win", TODAY)).toBeNull();
  });

  it("does not let yesterday's completion be claimed today", () => {
    const doneYesterday = { date: YESTERDAY, counts: { catch: 1, win: 2, chest: 3 }, claimed: [] };
    expect(claimTask(doneYesterday, "catch", TODAY)).toBeNull();
  });
});
