import { describe, expect, it } from "vitest";
import {
  canAccessWonderAcademySave,
  getWonderAcademyEntryCopy,
  shouldConfirmWonderAcademyOverwrite,
  visibleWonderAcademySaveStatus,
} from "./wonderAcademySessionGuards";

describe("getWonderAcademyEntryCopy", () => {
  it("requires sign-in without offering guest play", () => {
    expect(getWonderAcademyEntryCopy({ isGuest: true })).toEqual({
      primaryLabel: "登入後開始",
      secondaryLabel: null,
      noticeTitle: null,
      noticeBody: null,
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
  it("does not rewrite unauthenticated save states into guest-saved states", () => {
    expect(visibleWonderAcademySaveStatus({ isGuest: true, status: "idle" })).toBe("idle");
    expect(visibleWonderAcademySaveStatus({ isGuest: true, status: "pending" })).toBe("pending");
    expect(visibleWonderAcademySaveStatus({ isGuest: true, status: "saving" })).toBe("saving");
    expect(visibleWonderAcademySaveStatus({ isGuest: true, status: "failed" })).toBe("failed");
  });

  it("does not rewrite signed-in save states", () => {
    expect(visibleWonderAcademySaveStatus({ isGuest: false, status: "pending" })).toBe("pending");
    expect(visibleWonderAcademySaveStatus({ isGuest: false, status: "saved" })).toBe("saved");
  });
});

describe("canAccessWonderAcademySave", () => {
  it("requires a signed-in account before loading or saving game progress", () => {
    expect(canAccessWonderAcademySave({ isGuest: true })).toBe(false);
    expect(canAccessWonderAcademySave({ isGuest: false })).toBe(true);
  });
});
