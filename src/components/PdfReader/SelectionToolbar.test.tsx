import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SelectionToolbar } from "./SelectionToolbar";

let host: HTMLDivElement;
let root: Root;

function renderToolbar(selectedText: string): void {
  act(() => {
    root.render(
      <SelectionToolbar
        selectedText={selectedText}
        onSpeak={vi.fn()}
        onTranslate={vi.fn()}
        onClear={vi.fn()}
        onAddToVocabulary={vi.fn()}
      />,
    );
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("SelectionToolbar lookup actions", () => {
  it("offers lookup for a complete word with an internal hyphen", () => {
    renderToolbar("re-enter");

    expect(host.querySelector('[aria-label="查詢選取單字"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="翻譯選取文字"]')).toBeNull();
  });

  it("treats punctuation-wrapped text as a translation selection", () => {
    renderToolbar("hello,");

    expect(host.querySelector('[aria-label="查詢選取單字"]')).toBeNull();
    expect(host.querySelector('[aria-label="翻譯選取文字"]')).not.toBeNull();
  });
});
