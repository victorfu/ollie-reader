import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./WordPanelContent", () => ({
  WordPanelContent: ({ mode }: { mode: string }) => (
    <div data-testid="content" data-mode={mode} />
  ),
}));

import { WordPanelDock } from "./WordPanelDock";
import {
  DOCK_WIDTH_DEFAULT,
  DOCK_WIDTH_MAX,
  DOCK_WIDTH_MIN,
  VOCABULARY_DOCK_WIDTH_KEY,
} from "../../utils/vocabularyPanelPreferences";

function pointerEvent(type: string, clientX: number): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value() {},
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function renderDock() {
  act(() =>
    root.render(
      <WordPanelDock
        lookups={[]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onLookupWord={vi.fn()}
        onClose={vi.fn()}
        onToggleMode={vi.fn()}
      />,
    ),
  );
}

describe("WordPanelDock", () => {
  it("renders the shared content in docked mode", () => {
    renderDock();
    expect(
      host.querySelector('[data-testid="content"]')?.getAttribute("data-mode"),
    ).toBe("docked");
  });

  it("starts at the stored width", () => {
    localStorage.setItem(VOCABULARY_DOCK_WIDTH_KEY, "420");
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    expect(aside?.style.width).toBe("420px");
  });

  it("defaults its width when nothing is stored", () => {
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    expect(aside?.style.width).toBe(`${DOCK_WIDTH_DEFAULT}px`);
  });

  it("widens when the left edge is dragged left and persists the result", () => {
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    const grip = host.querySelector<HTMLElement>('[data-testid="vocab-dock-resize"]');

    act(() => {
      grip?.dispatchEvent(pointerEvent("pointerdown", 800));
      window.dispatchEvent(pointerEvent("pointermove", 760));
    });
    expect(aside?.style.width).toBe(`${DOCK_WIDTH_DEFAULT + 40}px`);

    act(() => {
      window.dispatchEvent(pointerEvent("pointerup", 760));
    });
    expect(localStorage.getItem(VOCABULARY_DOCK_WIDTH_KEY)).toBe(
      String(DOCK_WIDTH_DEFAULT + 40),
    );
  });

  it("clamps the dragged width to the allowed range", () => {
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    const grip = host.querySelector<HTMLElement>('[data-testid="vocab-dock-resize"]');

    act(() => {
      grip?.dispatchEvent(pointerEvent("pointerdown", 800));
      window.dispatchEvent(pointerEvent("pointermove", 100));
    });
    expect(aside?.style.width).toBe(`${DOCK_WIDTH_MAX}px`);

    act(() => {
      window.dispatchEvent(pointerEvent("pointermove", 1600));
    });
    expect(aside?.style.width).toBe(`${DOCK_WIDTH_MIN}px`);
  });

  it("stops resizing after pointerup", () => {
    renderDock();
    const aside = host.querySelector<HTMLElement>('[data-testid="vocab-dock"]');
    const grip = host.querySelector<HTMLElement>('[data-testid="vocab-dock-resize"]');

    act(() => {
      grip?.dispatchEvent(pointerEvent("pointerdown", 800));
      window.dispatchEvent(pointerEvent("pointermove", 780));
      window.dispatchEvent(pointerEvent("pointerup", 780));
      window.dispatchEvent(pointerEvent("pointermove", 400));
    });

    expect(aside?.style.width).toBe(`${DOCK_WIDTH_DEFAULT + 20}px`);
  });
});
