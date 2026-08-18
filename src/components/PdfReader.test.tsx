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
vi.mock("./PdfReader/WordPanel", () => ({
  WordPanel: ({ onToggleMode }: { onToggleMode: () => void }) => (
    <div data-testid="word-panel-floating" onClick={onToggleMode} />
  ),
}));
vi.mock("./PdfReader/WordPanelDock", () => ({
  WordPanelDock: ({ onToggleMode }: { onToggleMode: () => void }) => (
    <div data-testid="word-panel-dock" onClick={onToggleMode} />
  ),
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
    const dock = host.querySelector<HTMLElement>('[data-testid="word-panel-dock"]');

    act(() => dock?.click());

    expect(mocks.updateVocabularyPanelMode).toHaveBeenCalledWith("floating");
  });
});
