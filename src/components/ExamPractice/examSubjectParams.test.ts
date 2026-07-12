import { describe, expect, it } from "vitest";
import {
  examSubjectFromParam,
  isExamSubject,
  paramsForSubject,
} from "./examSubjectParams";

describe("exam subject query params", () => {
  it("uses chinese for a bare or invalid /exams URL", () => {
    expect(examSubjectFromParam(null)).toBe("chinese");
    expect(examSubjectFromParam("science")).toBe("chinese");
    expect(isExamSubject(null)).toBe(false);
    expect(isExamSubject("science")).toBe(false);
  });

  it("keeps all valid subjects explicit in the canonical URL", () => {
    expect(paramsForSubject("chinese")).toEqual({ subject: "chinese" });
    expect(paramsForSubject("math")).toEqual({ subject: "math" });
    expect(paramsForSubject("english")).toEqual({ subject: "english" });
    expect(examSubjectFromParam("chinese")).toBe("chinese");
    expect(examSubjectFromParam("math")).toBe("math");
    expect(examSubjectFromParam("english")).toBe("english");
    expect(isExamSubject("english")).toBe(true);
  });
});
