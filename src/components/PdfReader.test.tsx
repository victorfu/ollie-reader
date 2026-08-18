import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePdfState: vi.fn(),
  clearSelection: vi.fn(),
  fetchBookingRecords: vi.fn(),
  useIsDesktop: vi.fn(),
  vocabularyPanelMode: { current: "docked" as "docked" | "floating" },
  updateVocabularyPanelMode: vi.fn(),
}));

vi.mock("../hooks/usePdfState", () => ({ usePdfState: mocks.usePdfState }));
vi.mock("../hooks/usePdfWorker", () => ({ usePdfWorker: vi.fn() }));
vi.mock("../hooks/useSpeechState", () => ({
  useSpeechState: () => ({
    isSpeaking: false,
    isLoadingAudio: false,
    speechSupported: true,
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
  }),
}));
vi.mock("../hooks/useTextSelection", () => ({
  useTextSelection: () => ({
    selectedText: "orbit",
    handleTextSelection: vi.fn(),
    clearSelection: mocks.clearSelection,
    toolbarPosition: null,
  }),
}));
vi.mock("../hooks/useVocabulary", () => ({
  useVocabulary: () => ({ lookupOrAddWord: vi.fn() }),
  formatDefinitionsForDisplay: vi.fn(),
}));
vi.mock("../hooks/useLookupQueue", () => ({
  useLookupQueue: () => ({
    lookups: [],
    startLookup: vi.fn(),
    startTranslation: vi.fn(),
    dismissLookup: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../hooks/useMediaQuery", () => ({
  useIsDesktop: mocks.useIsDesktop,
  useMediaQuery: vi.fn(),
}));
vi.mock("../hooks/useSettings", () => ({
  useSettings: () => ({
    vocabularyPanelMode: mocks.vocabularyPanelMode.current,
    updateVocabularyPanelMode: mocks.updateVocabularyPanelMode,
  }),
}));
// Real useState so the lifted search state behaves as it does in production,
// without dragging Firestore into the test.
vi.mock("../hooks/useVocabularySearch", async () => {
  const React = await import("react");
  return {
    useVocabularySearch: () => {
      const [query, setQuery] = React.useState("");
      return {
        query,
        setQuery,
        results: null,
        isSearching: false,
        clearSearch: React.useCallback(() => setQuery(""), []),
      };
    },
  };
});
vi.mock("../hooks/useToastQueue", () => ({
  useToastQueue: () => ({ toasts: [], addToast: vi.fn(), removeToast: vi.fn() }),
}));
vi.mock("../hooks/useBookingRecords", () => ({
  useBookingRecords: () => ({
    bookingRecords: [],
    token: null,
    isLoading: false,
    error: null,
    fetchBookingRecords: mocks.fetchBookingRecords,
  }),
}));

vi.mock("./PdfReader/PdfViewer", () => ({
  PdfViewer: ({ url }: { url: string }) => (
    <div data-testid="pdf-viewer" data-url={url} />
  ),
}));
vi.mock("./PdfReader/UploadArea", () => ({ UploadArea: () => <div /> }));
vi.mock("./PdfReader/BookingRecordsDrawer", () => ({
  BookingRecordsDrawer: () => null,
}));
vi.mock("./PdfReader/SelectionToolbar", () => ({
  SelectionToolbar: ({ selectedText }: { selectedText: string }) =>
    selectedText ? <div data-testid="selection-toolbar" /> : null,
}));
type PanelStubProps = {
  canDock: boolean;
  onToggleMode: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  expandedWordId: string | null;
  onToggleExpandedWord: (wordId: string) => void;
};

// Both stubs mirror WordPanelContent's real contract: the mode toggle only
// exists where docking can take effect (locked by WordPanelContent.test.tsx).
function panelStub(testId: string) {
  return ({
    canDock,
    onToggleMode,
    query,
    onQueryChange,
    expandedWordId,
    onToggleExpandedWord,
  }: PanelStubProps) => (
    <div
      data-testid={testId}
      data-can-dock={String(canDock)}
      data-query={query}
      data-expanded={expandedWordId ?? ""}
    >
      {canDock && (
        <button
          type="button"
          data-testid={`${testId}-mode-toggle`}
          onClick={onToggleMode}
        />
      )}
      <button
        type="button"
        data-testid={`${testId}-type`}
        onClick={() => onQueryChange("orb")}
      />
      <button
        type="button"
        data-testid={`${testId}-expand`}
        onClick={() => onToggleExpandedWord("word-1")}
      />
    </div>
  );
}

vi.mock("./PdfReader/WordPanel", () => ({
  WordPanel: panelStub("word-panel-floating"),
}));
vi.mock("./PdfReader/WordPanelDock", () => ({
  WordPanelDock: panelStub("word-panel-dock"),
}));
vi.mock("./common/ToastContainer", () => ({ ToastContainer: () => null }));

import PdfReader from "./PdfReader";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.useIsDesktop.mockReturnValue(true);
  mocks.vocabularyPanelMode.current = "docked";
  mocks.usePdfState.mockReturnValue({
    selectedFile: new File(["pdf"], "lesson.pdf", { type: "application/pdf" }),
    isUploading: true,
    error: null,
    result: null,
    pdfUrl: "blob:lesson.pdf",
    initialScrollPosition: null,
    handleFileChange: vi.fn(),
    loadPdfFromUrl: vi.fn(),
    cancelUpload: vi.fn(),
    clearPdfCache: vi.fn(),
    saveScrollPosition: vi.fn(),
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("PdfReader PDF-only state", () => {
  it("keeps the viewer and text actions available while extraction is pending", () => {
    act(() => root.render(<PdfReader />));

    expect(host.querySelector('[data-testid="pdf-viewer"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="selection-toolbar"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="開啟生詞本"]')).not.toBeNull();
  });

  it("clears the previous document selection when the PDF changes", () => {
    act(() => root.render(<PdfReader />));
    mocks.clearSelection.mockClear();
    mocks.usePdfState.mockReturnValue({
      ...mocks.usePdfState.mock.results.at(-1)?.value,
      selectedFile: new File(["next"], "next.pdf", {
        type: "application/pdf",
      }),
      pdfUrl: "blob:next.pdf",
    });

    act(() => root.render(<PdfReader />));

    expect(mocks.clearSelection).toHaveBeenCalledTimes(1);
  });
});

describe("PdfReader vocabulary panel placement", () => {
  function openPanel() {
    act(() => root.render(<PdfReader />));
    const fab = host.querySelector<HTMLElement>('[aria-label="開啟生詞本"]');
    act(() => fab?.click());
  }

  it("docks the panel beside the PDF on desktop", () => {
    openPanel();

    expect(host.querySelector('[data-testid="word-panel-dock"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="word-panel-floating"]')).toBeNull();
  });

  it("falls back to the floating panel below the lg breakpoint", () => {
    mocks.useIsDesktop.mockReturnValue(false);
    openPanel();

    expect(host.querySelector('[data-testid="word-panel-dock"]')).toBeNull();
    expect(host.querySelector('[data-testid="word-panel-floating"]')).not.toBeNull();
  });

  it("floats when the stored preference is floating", () => {
    mocks.vocabularyPanelMode.current = "floating";
    openPanel();

    expect(host.querySelector('[data-testid="word-panel-floating"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="word-panel-dock"]')).toBeNull();
  });

  it("renders no panel until it is opened", () => {
    act(() => root.render(<PdfReader />));

    expect(host.querySelector('[data-testid="word-panel-dock"]')).toBeNull();
    expect(host.querySelector('[data-testid="word-panel-floating"]')).toBeNull();
  });

  it("switches the stored mode from the panel toggle", () => {
    openPanel();
    const toggle = host.querySelector<HTMLElement>(
      '[data-testid="word-panel-dock-mode-toggle"]',
    );

    act(() => toggle?.click());

    expect(mocks.updateVocabularyPanelMode).toHaveBeenCalledWith("floating");
  });

  it("offers no mode toggle below the lg breakpoint", () => {
    mocks.useIsDesktop.mockReturnValue(false);
    openPanel();
    const panel = host.querySelector<HTMLElement>(
      '[data-testid="word-panel-floating"]',
    );

    // Nothing to click: the control that would rewrite the preference into a
    // value the user cannot see the effect of is simply not rendered.
    expect(panel?.getAttribute("data-can-dock")).toBe("false");
    expect(
      host.querySelector('[data-testid="word-panel-floating-mode-toggle"]'),
    ).toBeNull();
    expect(mocks.updateVocabularyPanelMode).not.toHaveBeenCalled();
  });

  it("leaves the stored preference untouched when the breakpoint forces floating", () => {
    // Spec §5.3「偏好值不變」: narrow viewports fall back to floating for
    // display only, so widening the window restores the docked rail.
    mocks.useIsDesktop.mockReturnValue(false);
    openPanel();
    expect(host.querySelector('[data-testid="word-panel-floating"]')).not.toBeNull();
    expect(mocks.updateVocabularyPanelMode).not.toHaveBeenCalled();

    mocks.useIsDesktop.mockReturnValue(true);
    act(() => root.render(<PdfReader />));

    expect(host.querySelector('[data-testid="word-panel-dock"]')).not.toBeNull();
    expect(mocks.vocabularyPanelMode.current).toBe("docked");
    expect(mocks.updateVocabularyPanelMode).not.toHaveBeenCalled();
  });
});

describe("PdfReader vocabulary panel state", () => {
  function openPanel() {
    act(() => root.render(<PdfReader />));
    const fab = host.querySelector<HTMLElement>('[aria-label="開啟生詞本"]');
    act(() => fab?.click());
  }

  it("keeps the search term and expanded row when the shell is swapped", () => {
    openPanel();
    act(() => {
      host
        .querySelector<HTMLElement>('[data-testid="word-panel-dock-type"]')
        ?.click();
    });
    act(() => {
      host
        .querySelector<HTMLElement>('[data-testid="word-panel-dock-expand"]')
        ?.click();
    });
    const dock = host.querySelector<HTMLElement>('[data-testid="word-panel-dock"]');
    expect(dock?.getAttribute("data-query")).toBe("orb");
    expect(dock?.getAttribute("data-expanded")).toBe("word-1");

    // Cross the lg breakpoint: the docked rail unmounts and the floating shell
    // takes over, which used to wipe the search.
    mocks.useIsDesktop.mockReturnValue(false);
    act(() => root.render(<PdfReader />));

    const floating = host.querySelector<HTMLElement>(
      '[data-testid="word-panel-floating"]',
    );
    expect(floating?.getAttribute("data-query")).toBe("orb");
    expect(floating?.getAttribute("data-expanded")).toBe("word-1");
  });

  it("clears the search when the panel is closed and reopened", () => {
    openPanel();
    act(() => {
      host
        .querySelector<HTMLElement>('[data-testid="word-panel-dock-type"]')
        ?.click();
    });

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true }),
      ),
    );
    expect(host.querySelector('[data-testid="word-panel-dock"]')).toBeNull();

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true }),
      ),
    );

    expect(
      host
        .querySelector('[data-testid="word-panel-dock"]')
        ?.getAttribute("data-query"),
    ).toBe("");
  });
});
