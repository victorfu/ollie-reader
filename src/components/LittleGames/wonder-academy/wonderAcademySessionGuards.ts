export type WonderAcademyEntryCopy = {
  primaryLabel: string;
  secondaryLabel: string | null;
  noticeTitle: string | null;
  noticeBody: string | null;
};

export type WonderAcademyVisibleSaveStatus =
  | "idle"
  | "loading"
  | "saving"
  | "saved"
  | "pending"
  | "failed";

export function getWonderAcademyEntryCopy({
  isGuest,
}: {
  isGuest: boolean;
}): WonderAcademyEntryCopy {
  if (!isGuest) {
    return {
      primaryLabel: "開始冒險",
      secondaryLabel: null,
      noticeTitle: null,
      noticeBody: null,
    };
  }

  return {
    primaryLabel: "登入後開始",
    secondaryLabel: null,
    noticeTitle: null,
    noticeBody: null,
  };
}

export function shouldConfirmWonderAcademyOverwrite(teamSize: number): boolean {
  return teamSize > 0;
}

export function visibleWonderAcademySaveStatus({
  status,
}: {
  isGuest: boolean;
  status: WonderAcademyVisibleSaveStatus;
}): WonderAcademyVisibleSaveStatus {
  return status;
}

export function canAccessWonderAcademySave({
  isGuest,
}: {
  isGuest: boolean;
}): boolean {
  return !isGuest;
}
