import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SentenceHover } from "./SentenceHover";
const mocks = vi.hoisted(() => ({ sentences: vi.fn(), rects: vi.fn() }));
vi.mock("../../utils/pdfSentences", () => ({ layerSentences: mocks.sentences, sentenceRects: mocks.rects }));
let root: Root;
let host: HTMLDivElement;
let container: HTMLDivElement;
let text: HTMLSpanElement;
let onSpeak: ReturnType<typeof vi.fn<(text: string) => void>>;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
const rect = { left: 100, right: 240, top: 100, bottom: 120, width: 140, height: 20 } as DOMRect;
const button = () => document.querySelector<HTMLButtonElement>('[aria-label="朗讀句子"]') ?? document.querySelector<HTMLButtonElement>('button[title="First sentence."]');
function pointer(type: string, target: Element | Document = text, buttons = 0, pointerType = 'mouse', x = 120, y = 110) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, buttons });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => { target.dispatchEvent(event); vi.advanceTimersByTime(20); });
}
beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => media);
  host = document.createElement('div');
  container = document.createElement('div');
  container.innerHTML = '<div data-pdf-page-surface><div class="textLayer"><span>First sentence.</span></div></div>';
  text = container.querySelector('span')!;
  container.getBoundingClientRect = () => ({ top: 0, bottom: 500 }) as DOMRect;
  container.firstElementChild!.getBoundingClientRect = () => ({ left: 90 }) as DOMRect;
  document.body.append(host, container);
  mocks.sentences.mockReturnValue([{ text: 'First sentence.', ranges: [] }]);
  mocks.rects.mockReturnValue([rect]);
  onSpeak = vi.fn<(text: string) => void>();
  root = createRoot(host);
  act(() => root.render(<SentenceHover containerRef={{ current: container }} onSpeak={onSpeak} layoutKey="one" />));
});
afterEach(() => {
  act(() => root.unmount());
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  vi.unstubAllGlobals(); vi.useRealTimers();
});
it('previews a sentence without selecting it and plays only from the sentence-start button', () => {
  const before = container.innerHTML;
  pointer('pointermove');
  expect(button()).not.toBeNull();
  expect(button()!.style.left).toBe("100px");
  expect(button()!.style.top).toBe("62px");
  expect(window.getSelection()?.toString()).toBe('');
  expect(container.innerHTML).toBe(before);
  expect(onSpeak).not.toHaveBeenCalled();
  // Crossing the gutter must not remove the button before it can be clicked.
  pointer('pointermove', container, 0, 'mouse', 70);
  expect(button()).not.toBeNull();
  pointer('pointerdown', button()!);
  act(() => button()!.click());
  expect(onSpeak).toHaveBeenCalledExactlyOnceWith('First sentence.');
  mocks.sentences.mockReturnValue([{ text: 'Second sentence.', ranges: [] }]);
  pointer('pointerup');
  pointer('pointermove');
  act(() => vi.advanceTimersByTime(300));
  act(() => document.querySelector<HTMLButtonElement>('button[title="Second sentence."]')!.click());
  expect(onSpeak.mock.calls.map(call => call[0])).toEqual(['First sentence.', 'Second sentence.']);
});
it('hides on drag and selection, leaves the native range intact, then allows hover again', () => {
  pointer('pointermove');
  pointer('pointerdown', text, 1);
  expect(button()).toBeNull();
  pointer('pointermove', text, 1);
  expect(button()).toBeNull();
  pointer('pointerup');
  const range = document.createRange(); range.selectNodeContents(text);
  window.getSelection()!.addRange(range);
  act(() => document.dispatchEvent(new Event('selectionchange')));
  pointer('pointermove');
  expect(button()).toBeNull();
  expect(window.getSelection()!.getRangeAt(0)).toBe(range);
  window.getSelection()!.removeAllRanges();
  pointer('pointermove');
  expect(button()).not.toBeNull();
});
it('ignores touch and non-hover displays; clears stale geometry on scroll', () => {
  pointer('pointermove', text, 0, 'touch'); expect(button()).toBeNull();
  media.matches = false;
  pointer('pointermove'); expect(button()).toBeNull();
  media.matches = true;
  pointer('pointermove'); expect(button()).not.toBeNull();
  act(() => container.dispatchEvent(new Event('scroll')));
  expect(button()).toBeNull();
});

it('keeps Play reachable from a wrapped sentence through diagonal whitespace with no timeout', () => {
  pointer('pointermove');
  const originalButton = button()!;
  // Leave through blank text-layer space well outside the old 32px corridor.
  pointer('pointermove', text.parentElement!, 0, 'mouse', 260, 170);
  act(() => vi.advanceTimersByTime(2000));
  expect(button()).toBe(originalButton);
  pointer('pointermove', container, 0, 'mouse', 80, 160);
  act(() => vi.advanceTimersByTime(2000));
  expect(button()).toBe(originalButton);
  pointer('pointermove', originalButton, 0, 'mouse', 70, 110);
  pointer('pointerdown', originalButton);
  act(() => originalButton.click());
  expect(onSpeak).toHaveBeenCalledExactlyOnceWith('First sentence.');
});

it('does not switch sentences while traversing text toward Play, but switches after settling', () => {
  pointer('pointermove');
  mocks.sentences.mockReturnValue([{ text: 'Second sentence.', ranges: [] }]);
  // Traverse another sentence for longer than the former switch timeout.
  for (const x of [220, 200, 180, 160]) {
    pointer('pointermove', text, 0, 'mouse', x);
    act(() => vi.advanceTimersByTime(100));
    expect(button()?.title).toBe('First sentence.');
  }
  pointer('pointermove', container, 0, 'mouse', 70, 160);
  act(() => vi.advanceTimersByTime(1000));
  expect(button()?.title).toBe('First sentence.');
  pointer('pointermove', button()!);
  act(() => button()!.click());
  expect(onSpeak).toHaveBeenLastCalledWith('First sentence.');
  pointer('pointermove');
  act(() => vi.advanceTimersByTime(300));
  expect(document.querySelector('button[title="Second sentence."]')).not.toBeNull();
});
