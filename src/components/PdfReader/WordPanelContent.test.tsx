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
vi.mock("../../hooks/useVocabularySearch", () => ({
  useVocabularySearch: () => ({
    query: "",
    setQuery: vi.fn(),
    results: null,
    isSearching: false,
    clearSearch: vi.fn(),
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
    lookups: [completedLookup],
    onDismiss: vi.fn(),
    onDismissAll: vi.fn(),
    onLookupWord: vi.fn(),
    onClose: vi.fn(),
    onToggleMode: vi.fn(),
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
});
