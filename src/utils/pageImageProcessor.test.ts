import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDocument: vi.fn() }));

// 真正的 react-pdf／pdfjs 在 jsdom 載入會失敗；pdfConfig 載入時會設定 worker。
vi.mock("react-pdf", () => ({ pdfjs: { getDocument: mocks.getDocument } }));
vi.mock("./pdfConfig", () => ({ pdfDocumentOptions: {} }));

import {
  expandFilesToPages,
  fitLongEdge,
  nextRotation,
  rotatedSize,
  UNREADABLE_FILE_MESSAGE,
} from "./pageImageProcessor";

function fileOf(name: string, type: string, size?: number): File {
  const file = new File(["data"], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new ArrayBuffer(4),
  });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size });
  }
  return file;
}

describe("fitLongEdge", () => {
  it("scales the long edge down to the limit", () => {
    expect(fitLongEdge(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800 });
    expect(fitLongEdge(3000, 6000, 2400)).toEqual({ width: 1200, height: 2400 });
  });

  it("never scales up", () => {
    expect(fitLongEdge(800, 600, 2400)).toEqual({ width: 800, height: 600 });
  });
});

describe("rotatedSize", () => {
  it("swaps width and height for quarter turns", () => {
    expect(rotatedSize(100, 200, 90)).toEqual({ width: 200, height: 100 });
    expect(rotatedSize(100, 200, 270)).toEqual({ width: 200, height: 100 });
    expect(rotatedSize(100, 200, 180)).toEqual({ width: 100, height: 200 });
    expect(rotatedSize(100, 200, 0)).toEqual({ width: 100, height: 200 });
  });
});

describe("nextRotation", () => {
  it("cycles clockwise", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(180)).toBe(270);
    expect(nextRotation(270)).toBe(0);
  });
});

describe("expandFilesToPages", () => {
  beforeEach(() => {
    mocks.getDocument.mockReset();
  });

  it("turns each photo into one upright page", async () => {
    const { pages, errors } = await expandFilesToPages([
      fileOf("a.jpg", "image/jpeg"),
      fileOf("b.png", "image/png"),
    ]);
    expect(errors).toEqual([]);
    expect(pages.map((page) => [page.file.name, page.kind, page.rotation])).toEqual([
      ["a.jpg", "image", 0],
      ["b.png", "image", 0],
    ]);
    expect(new Set(pages.map((page) => page.key)).size).toBe(2);
  });

  it("expands a PDF into one page per PDF page", async () => {
    mocks.getDocument.mockImplementation(() => ({ promise: Promise.resolve({ numPages: 3 }) }));
    const { pages } = await expandFilesToPages([fileOf("exam.pdf", "application/pdf")]);
    expect(pages.map((page) => [page.kind, page.pdfPageNumber])).toEqual([
      ["pdf", 1],
      ["pdf", 2],
      ["pdf", 3],
    ]);
  });

  it("reports unreadable and oversized files without dropping the others", async () => {
    // 呼叫時才建立 rejected promise，避免在被 await 之前觸發 unhandled rejection
    mocks.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error("password")) }));
    const { pages, errors } = await expandFilesToPages([
      fileOf("notes.txt", "text/plain"),
      fileOf("big.jpg", "image/jpeg", 60 * 1024 * 1024),
      fileOf("locked.pdf", "application/pdf"),
      fileOf("ok.webp", "image/webp"),
    ]);
    expect(pages.map((page) => page.file.name)).toEqual(["ok.webp"]);
    expect(errors).toEqual([
      { fileName: "notes.txt", message: UNREADABLE_FILE_MESSAGE },
      { fileName: "big.jpg", message: "檔案超過 50MB，請拆開上傳" },
      { fileName: "locked.pdf", message: UNREADABLE_FILE_MESSAGE },
    ]);
  });
});
