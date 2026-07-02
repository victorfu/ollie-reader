import { describe, expect, it } from "vitest";
import {
  getWonderAcademyEntryCopy,
  shouldConfirmWonderAcademyOverwrite,
  visibleWonderAcademySaveStatus,
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

describe("visibleWonderAcademySaveStatus", () => {
  it("maps guest local and pending states to saved", () => {
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
