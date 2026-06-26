// Daily quests (spec §11 "每日節奏"): three small goals that reset each calendar
// day. Pure + date-agnostic — the calling component passes "today" (YYYY-M-D) in,
// so there is no clock dependency here and the logic is fully unit-testable.

export type DailyTaskId = "catch" | "win" | "chest";

export type DailyTaskDef = {
  id: DailyTaskId;
  /** Player-facing label. */
  label: string;
  /** How many times the tracked event must happen. */
  goal: number;
  /** Stardust paid out when claimed. */
  stardust: number;
};

const TASK_BY_ID: Record<DailyTaskId, DailyTaskDef> = {
  catch: { id: "catch", label: "收服 1 隻新朋友", goal: 1, stardust: 15 },
  win: { id: "win", label: "贏得 2 場對戰", goal: 2, stardust: 20 },
  chest: { id: "chest", label: "打開 3 個寶箱", goal: 3, stardust: 18 },
};

export const DAILY_TASKS: DailyTaskDef[] = [TASK_BY_ID.catch, TASK_BY_ID.win, TASK_BY_ID.chest];

export function taskDef(id: DailyTaskId): DailyTaskDef {
  return TASK_BY_ID[id];
}

export type DailyProgress = {
  /** The calendar day this progress belongs to (YYYY-M-D). */
  date: string;
  counts: Record<DailyTaskId, number>;
  /** Task ids whose reward has been collected today. */
  claimed: DailyTaskId[];
};

export function emptyDaily(date: string): DailyProgress {
  return { date, counts: { catch: 0, win: 0, chest: 0 }, claimed: [] };
}

/** Stored progress, reset to a clean slate when its day is stale (or absent). */
export function rolloverDaily(p: DailyProgress | null | undefined, today: string): DailyProgress {
  if (!p || p.date !== today) return emptyDaily(today);
  return p;
}

/** Record one (or more) events for a task, rolling the day over first. */
export function bumpDaily(
  p: DailyProgress | null | undefined,
  id: DailyTaskId,
  today: string,
  by = 1,
): DailyProgress {
  const cur = rolloverDaily(p, today);
  return { ...cur, counts: { ...cur.counts, [id]: cur.counts[id] + by } };
}

export function isComplete(p: DailyProgress, id: DailyTaskId): boolean {
  return p.counts[id] >= taskDef(id).goal;
}

export function isClaimable(p: DailyProgress, id: DailyTaskId): boolean {
  return isComplete(p, id) && !p.claimed.includes(id);
}

export function allClaimed(p: DailyProgress): boolean {
  return DAILY_TASKS.every((t) => p.claimed.includes(t.id));
}

/**
 * Claim a finished task → updated progress + the stardust to award. Returns null
 * when the task is not complete or was already claimed (rolling the day over
 * first, so yesterday's wins can't be cashed in today).
 */
export function claimTask(
  p: DailyProgress | null | undefined,
  id: DailyTaskId,
  today: string,
): { progress: DailyProgress; stardust: number } | null {
  const cur = rolloverDaily(p, today);
  if (!isClaimable(cur, id)) return null;
  return {
    progress: { ...cur, claimed: [...cur.claimed, id] },
    stardust: taskDef(id).stardust,
  };
}
