export type WonderAcademyEntryCopy = {
  primaryLabel: string;
  secondaryLabel: string | null;
  noticeTitle: string | null;
  noticeBody: string | null;
};

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
    secondaryLabel: "訪客試玩",
    noticeTitle: "訪客試玩只會保存在這台裝置",
    noticeBody: "登入 Google 後,Wonder Academy 進度會同步到雲端;訪客試玩不保證跨裝置保存。",
  };
}

export function shouldConfirmWonderAcademyOverwrite(teamSize: number): boolean {
  return teamSize > 0;
}
