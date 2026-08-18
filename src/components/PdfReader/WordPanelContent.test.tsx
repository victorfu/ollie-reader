import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateShowChineseTranslation: vi.fn(),
}));

vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({
    showChineseTranslation: false,
    updateShowChineseTranslation: mocks.updateShowChineseTranslation,
  }),
}));
import {
  WordPanelContent,
  type WordPanelContentProps,
} from "./WordPanelContent";
import type { LookupItem } from "../../hooks/useLookupQueue";

const completedLookup = {
  id: "1",
  type: "word",
  word: "tense",
  status: "done",
} as unknown as LookupItem;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function renderContent(overrides: Partial<Record<string, unknown>> = {}) {
  const props = {
    mode: "docked" as const,
    canDock: true,
    lookups: [completedLookup],
    onDismiss: vi.fn(),
    onDismissAll: vi.fn(),
    onLookupWord: vi.fn(),
    onClose: vi.fn(),
    onToggleMode: vi.fn(),
    query: "",
    onQueryChange: vi.fn(),
    searchResults: null,
    isSearching: false,
    expandedWordId: null,
    onToggleExpandedWord: vi.fn(),
    shouldFocusSearch: false,
    onSearchFocused: vi.fn(),
    disableItemLayoutAnimation: false,
    ...overrides,
  };
  act(() =>
    root.render(
      <WordPanelContent {...(props as unknown as WordPanelContentProps)} />,
    ),
  );
  return props;
}

describe("WordPanelContent header controls", () => {
  it("fires onDismissAll from the clear button", () => {
    const props = renderContent();
    const clear = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "清除",
    );

    act(() => clear?.click());

    expect(props.onDismissAll).toHaveBeenCalledTimes(1);
  });

  it("fires onClose from the minimise button", () => {
    const props = renderContent();
    const close = host.querySelector<HTMLElement>('[data-testid="panel-close"]');

    act(() => close?.click());

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onToggleMode from the dock toggle", () => {
    const props = renderContent();
    const toggle = host.querySelector<HTMLElement>('[data-testid="panel-mode-toggle"]');

    act(() => toggle?.click());

    expect(props.onToggleMode).toHaveBeenCalledTimes(1);
  });

  it("toggles the Chinese translation checkbox", () => {
    renderContent();
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]');

    act(() => checkbox?.click());

    expect(mocks.updateShowChineseTranslation).toHaveBeenCalledWith(true);
  });

  it("does not make the docked header a drag handle", () => {
    renderContent({ mode: "docked" });
    const header = host.querySelector<HTMLElement>('[data-testid="panel-header"]');

    expect(header?.style.cursor).toBe("");
  });

  it("makes the floating header a drag handle", () => {
    renderContent({
      mode: "floating",
      dragHandleProps: {
        onPointerDown: vi.fn(),
        style: { cursor: "grab", userSelect: "none", touchAction: "none" },
      },
    });
    const header = host.querySelector<HTMLElement>('[data-testid="panel-header"]');

    expect(header?.style.cursor).toBe("grab");
  });

  it("ignores drag props in docked mode even if a shell supplies them", () => {
    const onPointerDown = vi.fn();
    renderContent({
      mode: "docked",
      dragHandleProps: {
        onPointerDown,
        style: { cursor: "grab", userSelect: "none", touchAction: "none" },
      },
    });
    const header = host.querySelector<HTMLElement>('[data-testid="panel-header"]');

    act(() =>
      header?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })),
    );

    // `mode` is authoritative: a docked header never becomes a drag handle.
    expect(header?.style.cursor).toBe("");
    expect(onPointerDown).not.toHaveBeenCalled();
  });

  it("hides the mode toggle where docking cannot take effect", () => {
    const props = renderContent({ mode: "floating", canDock: false });

    expect(host.querySelector('[data-testid="panel-mode-toggle"]')).toBeNull();
    expect(props.onToggleMode).not.toHaveBeenCalled();
  });
});

describe("WordPanelContent search focus", () => {
  it("focuses the search box only when the panel asks for it", () => {
    vi.useFakeTimers();
    try {
      const props = renderContent({ shouldFocusSearch: false });
      act(() => vi.advanceTimersByTime(200));
      const input = host.querySelector<HTMLInputElement>(
        '[aria-label="搜尋或查詢單字"]',
      );
      expect(document.activeElement).not.toBe(input);
      expect(props.onSearchFocused).not.toHaveBeenCalled();

      renderContent({ shouldFocusSearch: true, onSearchFocused: props.onSearchFocused });
      act(() => vi.advanceTimersByTime(200));

      expect(
        host.querySelector('[aria-label="搜尋或查詢單字"]'),
      ).toBe(document.activeElement);
      expect(props.onSearchFocused).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
