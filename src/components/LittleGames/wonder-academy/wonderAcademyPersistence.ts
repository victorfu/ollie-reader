import type { WonderAcademyProgress } from "../../../types/wonderAcademy";

export type WonderAcademySaveTimestampIssuer = {
  issue: () => string;
};

export function createWonderAcademySaveTimestampIssuer(
  getNowMs: () => number = () => Date.now(),
): WonderAcademySaveTimestampIssuer {
  let lastIssuedMs = 0;

  return {
    issue: () => {
      const candidateMs = getNowMs();
      const nextMs =
        Number.isFinite(candidateMs) && candidateMs > lastIssuedMs
          ? candidateMs
          : lastIssuedMs + 1;

      lastIssuedMs = nextMs;

      return new Date(nextMs).toISOString();
    },
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
