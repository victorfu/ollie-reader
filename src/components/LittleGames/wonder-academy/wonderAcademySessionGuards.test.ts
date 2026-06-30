import { describe, expect, it } from "vitest";
import {
  getWonderAcademyEntryCopy,
  shouldConfirmWonderAcademyOverwrite,
} from "./wonderAcademySessionGuards";

describe("getWonderAcademyEntryCopy", () => {
  it("makes sign-in the primary action for guest players", () => {
    expect(getWonderAcademyEntryCopy({ isGuest: true })).toEqual({
      primaryLabel: "登入後開始",
      secondaryLabel: "訪客試玩",
      noticeTitle: "訪客試玩只會保存在這台裝置",
      noticeBody: "登入 Google 後,Wonder Academy 進度會同步到雲端;訪客試玩不保證跨裝置保存。",
    });
  });

  it("keeps the normal start action for signed-in players", () => {
    expect(getWonderAcademyEntryCopy({ isGuest: false })).toEqual({
      primaryLabel: "開始冒險",
      secondaryLabel: null,
      noticeTitle: null,
      noticeBody: null,
    });
  });
});

describe("shouldConfirmWonderAcademyOverwrite", () => {
  it("only requires confirmation when a team already exists", () => {
    expect(shouldConfirmWonderAcademyOverwrite(0)).toBe(false);
    expect(shouldConfirmWonderAcademyOverwrite(1)).toBe(true);
    expect(shouldConfirmWonderAcademyOverwrite(3)).toBe(true);
  });
});
