import { describe, expect, it } from "vitest";
import {
  examTabFromParam,
  isExamTab,
  paramsForTab,
} from "./examSubjectParams";

describe("exam tab query params", () => {
  it("uses chinese for a bare or invalid /exams URL", () => {
    expect(examTabFromParam(null)).toBe("chinese");
    expect(examTabFromParam("science")).toBe("chinese");
    expect(isExamTab(null)).toBe(false);
    expect(isExamTab("science")).toBe(false);
  });

  it("keeps all valid tabs explicit in the canonical URL", () => {
    expect(paramsForTab("chinese")).toEqual({ subject: "chinese" });
    expect(paramsForTab("math")).toEqual({ subject: "math" });
    expect(paramsForTab("english")).toEqual({ subject: "english" });
    expect(paramsForTab("mixed")).toEqual({ subject: "mixed" });
    expect(examTabFromParam("chinese")).toBe("chinese");
    expect(examTabFromParam("math")).toBe("math");
    expect(examTabFromParam("english")).toBe("english");
    expect(examTabFromParam("mixed")).toBe("mixed");
    expect(isExamTab("mixed")).toBe(true);
  });
});
