import { describe, expect, it } from "vitest";
import {
  getWonderAcademyArrivalState,
  wonderAcademyIntroCopy,
  wonderAcademyIntroVisualAlt,
} from "./wonderAcademyIntro";

describe("Wonder Academy intro copy", () => {
  it("uses a non-owl headmistress identity and generated-asset alt text", () => {
    expect(wonderAcademyIntroCopy.headmistressName).toBe("雲耳院長 薇拉");
    expect(wonderAcademyIntroCopy.headmistressName).not.toContain("貓頭鷹");
    expect(wonderAcademyIntroVisualAlt.headmistress).toContain("雲耳院長");
  });
});

describe("getWonderAcademyArrivalState", () => {
  it("keeps the arrival action unavailable until a child enters a name", () => {
    expect(getWonderAcademyArrivalState("   ")).toEqual({
      canContinue: false,
      trimmedName: "",
      personalLine: "寫下你的名字,讓入學星簿亮起來。",
      buttonLabel: "這就是我 →",
    });
  });

  it("personalizes the story beat with the trimmed player name", () => {
    expect(getWonderAcademyArrivalState("  小星  ")).toEqual({
      canContinue: true,
      trimmedName: "小星",
      personalLine: "小星,星葉學院的第一扇星光門已經為你打開。",
      buttonLabel: "這就是我 →",
    });
  });
});
