import { describe, expect, it } from "vitest";
import { isSupportedPdfFile } from "./pdfFile";

describe("isSupportedPdfFile", () => {
  it("accepts PDF MIME and PDF-named files with missing or generic MIME", () => {
    expect(isSupportedPdfFile({ name: "lesson", type: "application/pdf" })).toBe(
      true,
    );
    expect(isSupportedPdfFile({ name: "lesson.pdf", type: "" })).toBe(true);
    expect(
      isSupportedPdfFile({
        name: "lesson.pdf",
        type: "application/octet-stream",
      }),
    ).toBe(true);
  });

  it("does not accept generic non-PDF files by extension alone", () => {
    expect(
      isSupportedPdfFile({
        name: "lesson.txt",
        type: "application/octet-stream",
      }),
    ).toBe(false);
  });
});
