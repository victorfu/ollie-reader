import { afterEach, describe, expect, it } from "vitest";
import { findWordBounds, selectWordAtPoint } from "./pdfTextSelection";

type MutableCaretDocument = {
  caretPositionFromPoint?: (
    x: number,
    y: number,
  ) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

const caretDocument = document as unknown as MutableCaretDocument;

afterEach(() => {
  Reflect.deleteProperty(caretDocument, "caretPositionFromPoint");
  Reflect.deleteProperty(caretDocument, "caretRangeFromPoint");
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

function makePdfTextLayer(text: string): {
  page: HTMLDivElement;
  textNode: Text;
} {
  const page = document.createElement("div");
  const textLayer = document.createElement("div");
  textLayer.className = "textLayer";
  const span = document.createElement("span");
  const textNode = document.createTextNode(text);
  span.appendChild(textNode);
  textLayer.appendChild(span);
  page.appendChild(textLayer);
  document.body.appendChild(page);
  return { page, textNode };
}

describe("findWordBounds", () => {
  it("keeps apostrophes and hyphens inside English words", () => {
    expect(findWordBounds("can't re-enter", 2)).toEqual({ start: 0, end: 5 });
    expect(findWordBounds("can't re-enter", 9)).toEqual({ start: 6, end: 14 });
  });

  it("does not select punctuation or whitespace", () => {
    expect(findWordBounds("hello, world", 6)).toBeNull();
  });
});

describe("selectWordAtPoint", () => {
  it("uses caretPositionFromPoint and creates a real DOM selection", () => {
    const { page, textNode } = makePdfTextLayer("Learn proportional words");
    caretDocument.caretPositionFromPoint = () => ({
      offsetNode: textNode,
      offset: 10,
    });

    expect(selectWordAtPoint(page, 20, 30)).toBe("proportional");
    expect(window.getSelection()?.toString()).toBe("proportional");
  });

  it("falls back to Safari caretRangeFromPoint", () => {
    const { page, textNode } = makePdfTextLayer("Read this sentence");
    caretDocument.caretPositionFromPoint = () => null;
    caretDocument.caretRangeFromPoint = () => {
      const range = document.createRange();
      range.setStart(textNode, 7);
      range.collapse(true);
      return range;
    };

    expect(selectWordAtPoint(page, 20, 30)).toBe("this");
    expect(window.getSelection()?.toString()).toBe("this");
  });

  it("rejects a caret outside the current page text layer", () => {
    const { page } = makePdfTextLayer("Inside page");
    const outside = document.createTextNode("Outside page");
    document.body.appendChild(outside);
    caretDocument.caretPositionFromPoint = () => ({
      offsetNode: outside,
      offset: 3,
    });

    expect(selectWordAtPoint(page, 20, 30)).toBeNull();
    expect(window.getSelection()?.toString()).toBe("");
  });
});
