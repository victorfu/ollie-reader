import { describe, expect, it } from "vitest";
import { findNavLabel, isNavItemActive } from "./navLabel";

const items = [
  { to: "/exams", label: "考卷練習" },
  { to: "/my-exams", label: "自製考卷" },
  { to: "/games", label: "小遊戲" },
];

describe("isNavItemActive", () => {
  it("matches the item and its sub-pages only", () => {
    expect(isNavItemActive("/my-exams", "/my-exams")).toBe(true);
    expect(isNavItemActive("/my-exams", "/my-exams/sources/abc")).toBe(true);
    expect(isNavItemActive("/exams", "/my-exams")).toBe(false);
    expect(isNavItemActive("/my-exams", "/my-exams-old")).toBe(false);
  });
});

describe("findNavLabel", () => {
  it("labels sub-pages with their section", () => {
    expect(findNavLabel(items, "/my-exams/sources/abc")).toBe("自製考卷");
    expect(findNavLabel(items, "/games/spirit")).toBe("小遊戲");
    expect(findNavLabel(items, "/settings")).toBeUndefined();
  });
});
