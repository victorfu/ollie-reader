import { afterEach, describe, expect, it } from "vitest";
import { paragraphRuns, pdfParagraphText, pdfSelectionText, registerParagraphLayer, type ParagraphItem } from "./pdfParagraphText";

const item = (str: string, y: number, x = 10, fontSize = 20): ParagraphItem => ({
  str, hasEOL: true, transform: [fontSize, 0, 0, fontSize, x, y], width: str.length * 10,
});
afterEach(() => { window.getSelection()?.removeAllRanges(); document.body.replaceChildren(); });

describe("PDF paragraphs", () => {
  it("joins wrapped lines but retains large paragraph gaps", () => {
    expect(pdfParagraphText([item("no one knew", 100), item("about. She was", 76), item("wanted in life.", 52), item("Planet Corf was dark.", -300)]))
      .toBe("no one knew about. She was wanted in life.\n\nPlanet Corf was dark.");
  });
  it("preserves indentation, headings, lists and column changes", () => {
    expect(paragraphRuns([item("Title", 100, 10, 30), item("Body", 70), item("New paragraph", 46, 35), item("1. First", 22), item("2. Second", -2), item("Other column", 100, 300)]).slice(1).map(run => run.separator))
      .toEqual(Array(5).fill("\n\n"));
  });
  it("does not split glyph runs, strip punctuation or guess without geometry", () => {
    expect(pdfParagraphText([{ str: "I" }, { str: "R" }, { str: "S.gov", hasEOL: true }, { str: "Next" }])).toBe("IRS.gov\nNext");
  });
  it("handles empty line-end items and missing hasEOL using geometry", () => {
    expect(pdfParagraphText([{ ...item("Hello", 100), hasEOL: false }, { str: "", hasEOL: true }, { ...item("world.", 76), hasEOL: false }, item("Again", 52)])).toBe("Hello world. Again");
  });
});

function layer(items: ParagraphItem[]): HTMLElement {
  const result = document.createElement("div");
  result.className = "textLayer";
  items.filter(i => i.str).forEach(i => {
    const span = document.createElement("span");
    span.setAttribute("role", "presentation");
    const child = document.createElement("span");
    child.textContent = i.str;
    span.append(child);
    result.append(span);
  });
  document.body.append(result);
  return result;
}

it("normalizes partial selections across fitted nested spans without mutating DOM or range", () => {
  const items = [item("They knew", 100), item("about it.", 76), item("New paragraph.", 20)];
  const root = layer(items);
  const before = root.innerHTML;
  registerParagraphLayer(root, items);
  const range = document.createRange();
  range.setStart(root.children[0].firstChild!.firstChild!, 5);
  range.setEnd(root.children[2].firstChild!.firstChild!, 3);
  const selection = window.getSelection()!;
  selection.addRange(range);
  expect(pdfSelectionText(selection)).toBe("knew about it.\n\nNew");
  expect(root.innerHTML).toBe(before);
  expect(selection.getRangeAt(0)).toBe(range);
  expect(range.startOffset).toBe(5);
  expect(range.endOffset).toBe(3);
});

it("preserves page boundaries and leaves non-PDF/unregistered selections alone", () => {
  const a = layer([item("Page one", 100)]);
  const b = layer([item("Page two", 100)]);
  const range = document.createRange();
  range.setStart(a.children[0].firstChild!.firstChild!, 0);
  range.setEnd(b.children[0].firstChild!.firstChild!, 8);
  const selection = window.getSelection()!;
  selection.addRange(range);
  expect(pdfSelectionText(selection)).toBeNull();
  registerParagraphLayer(a, [item("Page one", 100)]);
  registerParagraphLayer(b, [item("Page two", 100)]);
  expect(pdfSelectionText(selection)).toBe("Page one\n\nPage two");
  a.className = "";
  expect(pdfSelectionText(selection)).toBeNull();
});
