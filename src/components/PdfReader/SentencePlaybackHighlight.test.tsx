import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SentencePlaybackHighlight } from "./SentencePlaybackHighlight";
const mocks = vi.hoisted(() => ({ sentences: vi.fn(), rects: vi.fn() }));
vi.mock("../../utils/pdfSentences", () => ({ layerSentences: mocks.sentences, sentenceRects: mocks.rects }));

it("tracks the chosen occurrence after scrolling and text replacement, clips to the reader, and preserves selection", async () => {
  vi.useFakeTimers();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  container.innerHTML = '<section data-page-number="5"><div class="textLayer">Same. Same.</div></section>';
  container.getBoundingClientRect = () => new DOMRect(50, 100, 400, 300);
  const host = document.createElement("div");
  document.body.append(container, host);
  const first = { text: "Same.", ranges: [] };
  const second = { text: "Same.", ranges: [] };
  mocks.sentences.mockReturnValue([first, second]);
  mocks.rects.mockReturnValue([new DOMRect(80, 90, 120, 30)]);
  const range = document.createRange(); range.selectNodeContents(container.querySelector('.textLayer')!);
  window.getSelection()!.addRange(range);
  const root = createRoot(host);
  try {
    act(() => root.render(<SentencePlaybackHighlight containerRef={{ current: container }} target={{ page: 5, index: 1, text: "Same." }} />));
    act(() => vi.advanceTimersByTime(20));
    const mark = () => document.querySelector<HTMLElement>('[data-testid="sentence-playback-highlight"] span')!;
    expect(mocks.rects).toHaveBeenLastCalledWith(second);
    expect(mark().style.top).toBe('100px');
    expect(mark().style.height).toBe('20px');
    expect(window.getSelection()!.getRangeAt(0)).toBe(range);
    mocks.rects.mockReturnValue([new DOMRect(80, 150, 120, 30)]);
    act(() => { container.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(20); });
    expect(mark().style.top).toBe('150px');
    const replacement = { text: "Same.", ranges: [] };
    mocks.sentences.mockReturnValue([first, replacement]);
    await act(async () => { container.querySelector('.textLayer')!.textContent = 'Resized'; });
    act(() => vi.advanceTimersByTime(20));
    expect(mocks.rects).toHaveBeenLastCalledWith(replacement);
    act(() => root.unmount());
    expect(document.querySelector('[data-testid="sentence-playback-highlight"]')).toBeNull();
  } finally {
    window.getSelection()!.removeAllRanges();
    host.remove(); container.remove();
    vi.useRealTimers();
  }
});
