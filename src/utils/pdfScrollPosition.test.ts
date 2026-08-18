import { describe, expect, it } from "vitest";

import {
  computeRestoredScrollTop,
  computeScrollRatio,
} from "./pdfScrollPosition";

// jsdom performs no layout — scrollHeight/clientHeight are always 0 — so the
// maths that keeps the reading position across a PDF column width change is
// verified directly here. PdfViewer.test.tsx covers the wiring around it.
describe("scroll ratio preservation maths", () => {
  it("reports the fraction of the document above the viewport", () => {
    expect(computeScrollRatio(2_000, 8_000)).toBe(0.25);
    expect(computeScrollRatio(0, 8_000)).toBe(0);
  });

  it("treats an unmeasurable container as the top of the document", () => {
    expect(computeScrollRatio(100, 0)).toBe(0);
    expect(computeScrollRatio(Number.NaN, 8_000)).toBe(0);
    expect(computeScrollRatio(100, Number.NaN)).toBe(0);
    expect(computeScrollRatio(-50, 8_000)).toBe(0);
    expect(computeScrollRatio(9_000, 8_000)).toBe(1);
  });

  it("maps the same fraction onto a shorter document", () => {
    // Opening the dock at 1440px takes the column 1144 -> 768, shrinking the
    // document by about a third; the same paragraph must stay in view.
    const ratio = computeScrollRatio(2_000, 8_000);
    expect(computeRestoredScrollTop(ratio, 6_000, 800)).toBe(1_500);
  });

  it("never scrolls past what the container can reach", () => {
    expect(computeRestoredScrollTop(0.99, 6_000, 800)).toBe(5_200);
    expect(computeRestoredScrollTop(0.5, 600, 800)).toBe(0);
  });

  it("stays at the top for a missing or degenerate ratio", () => {
    expect(computeRestoredScrollTop(0, 6_000, 800)).toBe(0);
    expect(computeRestoredScrollTop(-1, 6_000, 800)).toBe(0);
    expect(computeRestoredScrollTop(Number.NaN, 6_000, 800)).toBe(0);
    expect(computeRestoredScrollTop(0.5, Number.NaN, 800)).toBe(0);
  });
});
