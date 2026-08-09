import { describe, expect, it } from "vitest";
import type { PdfWord } from "../types/pdf";
import {
  clientPointToPdfPoint,
  findPdfWordAtPoint,
  joinPdfWords,
  normalizePdfWords,
  pdfWordToClientRect,
} from "./pdfWordSelection";

const words: PdfWord[] = [
  { text: "Once", x0: 20, y0: 20, x1: 70, y1: 40 },
  { text: "upon", x0: 80, y0: 20, x1: 130, y1: 40 },
  { text: "a", x0: 20, y0: 55, x1: 30, y1: 75 },
  { text: "time,", x0: 40, y0: 55, x1: 90, y1: 75 },
];

describe("PDF native-word geometry", () => {
  it("maps client coordinates to rotated CropBox coordinates with independent axes", () => {
    const rootRect = {
      left: 100,
      top: 200,
      width: 1_000,
      height: 660,
    };

    expect(
      clientPointToPdfPoint(300, 420, rootRect, 500, 300),
    ).toEqual({ x: 100, y: 100 });
  });

  it("hits exact word boxes and rejects surrounding whitespace", () => {
    expect(findPdfWordAtPoint(words, { x: 100, y: 30 })).toBe(1);
    expect(findPdfWordAtPoint(words, { x: 75, y: 30 })).toBeNull();
  });

  it("maps a rotated page word back to its live client rectangle", () => {
    const rect = pdfWordToClientRect(
      { text: "Rotate", x0: 522, y0: 72, x1: 550, y1: 131 },
      { left: 10, top: 20, width: 1_200, height: 1_000 },
      600,
      500,
    );

    expect(rect).toMatchObject({
      left: 1054,
      top: 164,
      right: 1110,
      bottom: 282,
      width: 56,
      height: 118,
    });
  });

  it("filters invalid data and clamps boxes to the page viewport", () => {
    expect(
      normalizePdfWords(
        [
          ...words,
          { text: "", x0: 0, y0: 0, x1: 10, y1: 10 },
          { text: "bad", x0: Number.NaN, y0: 0, x1: 10, y1: 10 },
          { text: "edge", x0: -5, y0: -2, x1: 15, y1: 12 },
        ],
        500,
        300,
      ),
    ).toEqual([
      ...words,
      { text: "edge", x0: 0, y0: 0, x1: 15, y1: 12 },
    ]);
  });
});

describe("PDF native-word selection text", () => {
  it("joins forward and reverse multi-line ranges in reading order", () => {
    expect(joinPdfWords(words, 0, 3)).toBe("Once upon a time,");
    expect(joinPdfWords(words, 3, 0)).toBe("Once upon a time,");
  });

  it("does not split adjacent CJK and repairs a remaining line-end hyphen", () => {
    expect(
      joinPdfWords(
        [
          { text: "中文", x0: 0, y0: 0, x1: 10, y1: 10 },
          { text: "完整", x0: 11, y0: 0, x1: 21, y1: 10 },
          { text: "informa-", x0: 0, y0: 20, x1: 30, y1: 30 },
          { text: "tion", x0: 0, y0: 40, x1: 20, y1: 50 },
        ],
        0,
        1,
      ),
    ).toBe("中文完整");
    expect(
      joinPdfWords(
        [
          { text: "informa-", x0: 0, y0: 0, x1: 30, y1: 10 },
          { text: "tion", x0: 0, y0: 20, x1: 20, y1: 30 },
        ],
        0,
        1,
      ),
    ).toBe("information");
  });

  it("keeps a meaningful hyphen between words on the same line", () => {
    expect(
      joinPdfWords(
        [
          { text: "well-", x0: 0, y0: 0, x1: 30, y1: 10 },
          { text: "known", x0: 35, y0: 0, x1: 65, y1: 10 },
        ],
        0,
        1,
      ),
    ).toBe("well- known");
  });
});
