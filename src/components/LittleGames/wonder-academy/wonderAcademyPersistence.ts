import type { WonderAcademyProgress } from "../../../types/wonderAcademy";

export type WonderAcademySaveTimestampIssuer = {
  issue: () => string;
  issueAfter: (after?: string | null) => string;
};

export function createWonderAcademySaveTimestampIssuer(
  getNowMs: () => number = () => Date.now(),
): WonderAcademySaveTimestampIssuer {
  let lastIssuedMs = 0;

  const issueAfter = (after?: string | null) => {
    const candidateMs = getNowMs();
    const afterMs = after ? Date.parse(after) : Number.NaN;
    const nextMs =
      Math.max(
        Number.isFinite(candidateMs) ? candidateMs : 0,
        Number.isFinite(afterMs) ? afterMs + 1 : 0,
        lastIssuedMs + 1,
      );

    lastIssuedMs = nextMs;

    return new Date(nextMs).toISOString();
  };

  return {
    issue: () => issueAfter(),
    issueAfter,
  };
}

export function canFlushPendingAudioProgress({
  activeUserId,
  expectedUserId,
  progress,
}: {
  activeUserId: string | null;
  expectedUserId?: string | null;
  progress: WonderAcademyProgress;
}): boolean {
  const allowedUserId = expectedUserId ?? activeUserId;

  return Boolean(allowedUserId) && progress.userId === allowedUserId;
}

export function shouldKeepCurrentProgressOverSaveResult(
  current: WonderAcademyProgress | null | undefined,
  result: WonderAcademyProgress,
): boolean {
  if (!current || current.userId !== result.userId) {
    return false;
  }

  const currentUpdatedAtMs = Date.parse(current.updatedAt);
  const resultUpdatedAtMs = Date.parse(result.updatedAt);

  if (!Number.isFinite(currentUpdatedAtMs) || !Number.isFinite(resultUpdatedAtMs)) {
    return false;
  }

  return currentUpdatedAtMs > resultUpdatedAtMs;
}
