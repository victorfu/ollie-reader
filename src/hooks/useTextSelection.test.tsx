import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { useTextSelection } from "./useTextSelection";
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
