import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useTextSelection } from "./useTextSelection";
import { SelectionToolbar } from "../components/PdfReader/SelectionToolbar";
import { registerParagraphLayer } from "../utils/pdfParagraphText";

it("passes normalized PDF text to selection actions while retaining visual selection", () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let result: ReturnType<typeof useTextSelection>;
  function Harness() {
    const value = useTextSelection();
    useLayoutEffect(() => { result = value; });
    return null;
  }
  const host = document.createElement("div");
  const layer = document.createElement("div");
  layer.className = "textLayer";
  layer.innerHTML = '<span role="presentation">knew</span><br><span role="presentation">about it.</span><br><span role="presentation">Next paragraph.</span>';
  document.body.append(host, layer);
  registerParagraphLayer(layer, [100, 76, 20].map((y, i) => ({
    str: ["knew", "about it.", "Next paragraph."][i], hasEOL: true, transform: [20, 0, 0, 20, 10, y],
  })));
  const range = document.createRange();
  range.selectNodeContents(layer);
  range.getBoundingClientRect = () => ({ left: 10, top: 200, bottom: 280, width: 100, height: 80 }) as DOMRect;
  window.getSelection()!.addRange(range);
  const root = createRoot(host);
  try {
    act(() => root.render(<Harness />));
    act(() => result!.handleTextSelection());
    expect(result!.selectedText).toBe("knew about it.\n\nNext paragraph.");
    expect(window.getSelection()!.getRangeAt(0)).toBe(range);
  } finally {
    act(() => root.unmount());
    window.getSelection()!.removeAllRanges();
    host.remove(); layer.remove();
  }
});

it.each(["replace", "remove", "collapse"])("clears text and toolbar when native selection becomes invalid: %s", (change) => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let result: ReturnType<typeof useTextSelection>;
  const onSpeak = vi.fn();
  function Harness() {
    const value = useTextSelection();
    useLayoutEffect(() => { result = value; });
    return <SelectionToolbar selectedText={value.selectedText} position={value.toolbarPosition}
      onSpeak={() => onSpeak(value.selectedText)} onTranslate={() => {}} onClear={value.clearSelection} />;
  }
  const host = document.createElement("div");
  const layer = document.createElement("div");
  layer.textContent = "Selected PDF text";
  document.body.append(host, layer);
  const root = createRoot(host);
  const select = () => {
    const range = document.createRange();
    range.selectNodeContents(layer.firstChild!);
    range.getBoundingClientRect = () => ({ left: 10, top: 200, bottom: 220, width: 100, height: 20 }) as DOMRect;
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    act(() => result!.handleTextSelection());
  };
  try {
    act(() => root.render(<Harness />));
    select();
    const button = host.querySelector<HTMLButtonElement>('[aria-label="朗讀選取文字"]')!;
    expect(button).not.toBeNull();
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    act(() => button.dispatchEvent(down));
    expect(down.defaultPrevented).toBe(true);
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
      button.click();
    });
    expect(onSpeak).toHaveBeenCalledWith("Selected PDF text");
    act(() => {
      if (change === "replace") layer.replaceChildren(document.createTextNode("Resized PDF text"));
      else if (change === "remove") window.getSelection()!.removeAllRanges();
      else window.getSelection()!.collapseToStart();
      document.dispatchEvent(new Event("selectionchange"));
    });
    expect(result!.selectedText).toBe("");
    expect(result!.toolbarPosition).toBeNull();
    expect(host.querySelector('[aria-label="朗讀選取文字"]')).toBeNull();
    // Selecting again after a render must work, even if the text is unchanged.
    select();
    expect(result!.selectedText).toBe(layer.textContent);
    expect(host.querySelector('[aria-label="朗讀選取文字"]')).not.toBeNull();
  } finally {
    act(() => root.unmount());
    window.getSelection()!.removeAllRanges();
    host.remove(); layer.remove();
  }
});
