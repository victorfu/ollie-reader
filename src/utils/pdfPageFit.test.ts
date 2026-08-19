import { describe, expect, it } from "vitest";
import {
  MIN_FIT_PAGE_WIDTH,
  computeFitPageWidth,
} from "./pdfPageFit";

const A4_PORTRAIT = 595 / 842;
const SLIDE_16_9 = 16 / 9;

describe("computeFitPageWidth", () => {
  it("keeps the column width when a whole page already fits", () => {
    expect(
      computeFitPageWidth({
        columnWidth: 944,
        availableHeight: 900,
        pageAspectRatio: SLIDE_16_9,
      }),
    ).toBe(944);
  });

  it("narrows a 16:9 slide so it fits a short viewport", () => {
    // 440px of visible box only has room for a 782px-wide slide.
    expect(
      computeFitPageWidth({
        columnWidth: 944,
        availableHeight: 440,
        pageAspectRatio: SLIDE_16_9,
      }),
    ).toBe(782);
  });

  it("narrows a portrait page much harder than a slide", () => {
    expect(
      computeFitPageWidth({
        columnWidth: 944,
        availableHeight: 600,
        pageAspectRatio: A4_PORTRAIT,
      }),
    ).toBe(423);
  });

  it("stops narrowing at the readability floor", () => {
    expect(
      computeFitPageWidth({
        columnWidth: 944,
        availableHeight: 120,
        pageAspectRatio: A4_PORTRAIT,
      }),
    ).toBe(MIN_FIT_PAGE_WIDTH);
  });

  it("never widens a page past the column it sits in", () => {
    expect(
      computeFitPageWidth({
        columnWidth: 280,
        availableHeight: 100,
        pageAspectRatio: A4_PORTRAIT,
      }),
    ).toBe(280);
  });

  it("falls back to the column width before a page reports its aspect", () => {
    expect(
      computeFitPageWidth({
        columnWidth: 760,
        availableHeight: 400,
        pageAspectRatio: null,
      }),
    ).toBe(760);
  });

  it("falls back to the column width when the box height is unmeasured", () => {
    expect(
      computeFitPageWidth({
        columnWidth: 760,
        availableHeight: 0,
        pageAspectRatio: SLIDE_16_9,
      }),
    ).toBe(760);
  });

  it("reports nothing to render until the column is measured", () => {
    expect(
      computeFitPageWidth({
        columnWidth: 0,
        availableHeight: 800,
        pageAspectRatio: SLIDE_16_9,
      }),
    ).toBe(0);
  });
});
