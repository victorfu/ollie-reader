import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "../utils/logger";
import { usePdfState } from "../hooks/usePdfState";
import { useSpeechState } from "../hooks/useSpeechState";
import { useTextSelection } from "../hooks/useTextSelection";
import { usePdfWorker } from "../hooks/usePdfWorker";
import { useVocabulary, formatDefinitionsForDisplay } from "../hooks/useVocabulary";
import { useLookupQueue } from "../hooks/useLookupQueue";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { useVocabularySearch } from "../hooks/useVocabularySearch";
import { createTranslateFn } from "../utils/translateFactory";
import { UploadArea } from "./PdfReader/UploadArea";
import { PdfViewer } from "./PdfReader/PdfViewer";
import { SelectionToolbar } from "./PdfReader/SelectionToolbar";
import { WordPanel } from "./PdfReader/WordPanel";
import { WordPanelDock } from "./PdfReader/WordPanelDock";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { ToastContainer } from "./common/ToastContainer";
import { useToastQueue } from "../hooks/useToastQueue";
import { BookingRecordsDrawer } from "./PdfReader/BookingRecordsDrawer";
import { useBookingRecords } from "../hooks/useBookingRecords";

function PdfReader() {
  // Use custom hooks
  usePdfWorker();

  // Use PDF state from context instead of local hook
  const {
    selectedFile,
    isUploading,
    error,
    result,
    pdfUrl,
    initialScrollPosition,
    handleFileChange,
    loadPdfFromUrl,
    cancelUpload,
    clearPdfCache,
    saveScrollPosition,
  } = usePdfState();

  const {
    isSpeaking,
    isLoadingAudio,
    speechSupported,
    speak,
    stopSpeaking,
  } = useSpeechState();

  const { user } = useAuth();

  const { vocabularyPanelMode, updateVocabularyPanelMode } = useSettings();
  const isDesktop = useIsDesktop();
  const isDocked = vocabularyPanelMode === "docked" && isDesktop;

  const toggleVocabularyPanelMode = useCallback(
    () =>
      updateVocabularyPanelMode(
        vocabularyPanelMode === "docked" ? "floating" : "docked",
      ),
    [vocabularyPanelMode, updateVocabularyPanelMode],
  );

  // The panel's search and expansion state lives here, above both shells, so
  // switching modes or crossing the lg breakpoint — which swaps one shell for
  // the other — no longer discards a half-typed query or an expanded row.
  const { query, setQuery, results, isSearching, clearSearch } =
    useVocabularySearch();
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [shouldFocusSearch, setShouldFocusSearch] = useState(false);

  const handleToggleExpandedWord = useCallback((wordId: string) => {
    setExpandedWordId((previous) => (previous === wordId ? null : wordId));
  }, []);

  const handleSearchFocused = useCallback(() => setShouldFocusSearch(false), []);

  const {
    selectedText,
    handleTextSelection,
    clearSelection,
    toolbarPosition,
  } = useTextSelection();

  // A selection belongs to the rendered text layer of one PDF only.
  useEffect(() => {
    clearSelection();
  }, [pdfUrl, clearSelection]);

  const {
    bookingRecords,
    token: bookingToken,
    isLoading: isLoadingBookingRecords,
    error: bookingRecordsError,
    fetchBookingRecords,
  } = useBookingRecords();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wordPanelOpen, setWordPanelOpen] = useState(false);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);

  // Opening the panel is what earns the search box focus — not merely mounting
  // a shell, which also happens on a mode toggle or a breakpoint crossing.
  const openWordPanel = useCallback(() => {
    if (!wordPanelOpen) setShouldFocusSearch(true);
    setWordPanelOpen(true);
  }, [wordPanelOpen]);

  // Closing discards the session's search — the panel reopens clean, which is
  // the reset the old unmount cleanup used to perform.
  const closeWordPanel = useCallback(() => {
    setWordPanelOpen(false);
    setShouldFocusSearch(false);
    setExpandedWordId(null);
    clearSearch();
  }, [clearSearch]);

  // 打開「課程預約」抽屜時才抓取（lazy）：避免未使用預約功能時的多餘請求與背景 400，
  // 並讓「未設定 OIKID 帳密」的訊息在使用者真正開啟抽屜時才出現。
  useEffect(() => {
    if (drawerOpen) {
      fetchBookingRecords();
    }
  }, [drawerOpen, fetchBookingRecords]);

  // Keyboard shortcut: Cmd/Ctrl+K to toggle the word panel
  useEffect(() => {
    if (!pdfUrl) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (wordPanelOpen) closeWordPanel();
        else openWordPanel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pdfUrl, wordPanelOpen, openWordPanel, closeWordPanel]);

  // Refs for race condition handling
  const loadingCourseIdRef = useRef<string | null>(null);

  const handleLoadBookingPdf = async (record: { id: string }) => {
    if (!bookingToken || !record.id) return;

    // Track current request to handle race conditions
    const currentCourseId = record.id;
    loadingCourseIdRef.current = currentCourseId;
    setLoadingCourseId(currentCourseId);

    try {
      const url = `https://www.oikid.com/PHP/Review.php?id=${record.id}&token=${bookingToken}`;
      await loadPdfFromUrl(url);
      // Only close drawer if this is still the active request
      if (loadingCourseIdRef.current === currentCourseId) {
        setDrawerOpen(false);
      }
    } catch (error) {
      logger.error("Error loading booking PDF:", error);
      // Only show error if this is still the active request
      if (loadingCourseIdRef.current === currentCourseId) {
        addToast("載入課程 PDF 失敗", "error");
      }
    } finally {
      // Only reset loading state if this is still the active request
      if (loadingCourseIdRef.current === currentCourseId) {
        setLoadingCourseId(null);
      }
    }
  };

  const [isClearingCache, setIsClearingCache] = useState(false);

  // Toast queue for multiple notifications
  const { toasts, addToast, removeToast } = useToastQueue(3);

  // Vocabulary hook
  const { lookupOrAddWord } = useVocabulary();
  const {
    lookups,
    startLookup,
    startTranslation,
    dismissLookup,
    dismissAll,
  } = useLookupQueue(lookupOrAddWord, formatDefinitionsForDisplay);

  const pagesByNumber = useMemo(() => {
    const map = new Map();
    if (result) {
      for (const p of result.pages) map.set(p.page_number, p);
    }
    return map;
  }, [result]);

  // Handlers for child components
  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] ?? null;
    handleFileChange(file);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileChange(file);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
  };

  const speakSelection = () => {
    if (selectedText) {
      speak(selectedText);
    }
  };

  // Queue-based lookup and add to vocabulary
  const handleLookupWord = () => {
    const trimmedText = selectedText.trim();
    if (!trimmedText) return;
    openWordPanel();

    const word = trimmedText.split(/\s+/)[0];
    const result = startLookup(word, {
      sourceContext: trimmedText,
      sourcePdfName: selectedFile?.name,
    });

    if (result === "duplicate") {
      addToast(`「${word}」正在查詢中`, "info");
    } else if (result === "max_reached") {
      addToast("待處理查詢數量已達上限", "error");
    }

    clearSelection();
  };

  // Lookup a word typed directly into the panel's search row
  const handleLookupTypedWord = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    openWordPanel();

    const result = startLookup(trimmed, {
      sourcePdfName: selectedFile?.name,
    });

    if (result === "duplicate") {
      addToast(`「${trimmed}」正在查詢中`, "info");
    } else if (result === "max_reached") {
      addToast("待處理查詢數量已達上限", "error");
    }
  };

  // Queue-based sentence translation
  const handleTranslate = () => {
    const trimmedText = selectedText.trim();
    if (!trimmedText) return;
    openWordPanel();

    const result = startTranslation(
      trimmedText,
      createTranslateFn(user, selectedFile?.name),
    );

    if (result === "duplicate") {
      addToast("此句子正在翻譯中", "info");
    } else if (result === "max_reached") {
      addToast("待處理查詢數量已達上限", "error");
    }

    clearSelection();
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearPdfCache();
      addToast("快取已清除，請重新載入 PDF", "success");
    } catch (error) {
      logger.error("Error clearing cache:", error);
      addToast("清除快取時發生錯誤", "error");
    } finally {
      setIsClearingCache(false);
    }
  };

  const uploadAreaProps = {
    selectedFile,
    isUploading,
    speechSupported,
    onFileChange: onInputChange,
    onDrop,
    onDragOver,
    onCancel: cancelUpload,
    onOpenBookingDrawer: () => setDrawerOpen(true),
    onClearCache: pdfUrl ? handleClearCache : undefined,
    isClearingCache,
  };

  // One prop bag, one source of truth: whichever shell is mounted receives the
  // exact same panel state.
  const wordPanelProps = {
    canDock: isDesktop,
    lookups,
    onDismiss: dismissLookup,
    onDismissAll: dismissAll,
    onSpeak: speak,
    onLookupWord: handleLookupTypedWord,
    onClose: closeWordPanel,
    onToggleMode: toggleVocabularyPanelMode,
    query,
    onQueryChange: setQuery,
    searchResults: results,
    isSearching,
    expandedWordId,
    onToggleExpandedWord: handleToggleExpandedWord,
    shouldFocusSearch,
    onSearchFocused: handleSearchFocused,
  };

  return (
    <div className="relative flex h-[calc(100dvh-var(--reader-chrome-h))] w-full flex-col">

      {/* Upload Area + 課程紀錄按鈕 — the page's drop target until a PDF is
          open, after which the same controls live in the viewer's header row
          so the reader spends its height on the page instead of on a second
          bar. */}
      {!pdfUrl && (
        <div className="relative shrink-0">
          <UploadArea {...uploadAreaProps} />
        </div>
      )}

      {/* Booking Records Drawer */}
      <BookingRecordsDrawer
        isOpen={drawerOpen}
        bookingRecords={bookingRecords}
        loadingCourseId={loadingCourseId}
        isLoading={isLoadingBookingRecords}
        error={bookingRecordsError}
        onClose={() => setDrawerOpen(false)}
        onSelectRecord={handleLoadBookingPdf}
        onRetry={fetchBookingRecords}
      />

      {/* Error Alert - macOS HIG style */}
      {error && (
        <div className="shrink-0 rounded-lg bg-error/10 border border-error/20 px-4 py-3 mb-6">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Selection Toolbar */}
      {pdfUrl && (
        <SelectionToolbar
          selectedText={selectedText}
          onSpeak={speakSelection}
          onTranslate={handleTranslate}
          onClear={clearSelection}
          onAddToVocabulary={handleLookupWord}
          position={toolbarPosition}
        />
      )}

      {/* PDF is published as soon as its blob is available. Text hydrates later. */}
      {pdfUrl && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-border-hairline bg-base-100 shadow-elevated">
            <PdfViewer
              url={pdfUrl}
              pagesByNumber={pagesByNumber}
              onSpeak={speak}
              onTextSelection={handleTextSelection}
              isLoadingAudio={isLoadingAudio}
              isSpeaking={isSpeaking}
              initialScrollPosition={initialScrollPosition}
              onScrollPositionChange={saveScrollPosition}
              headerActions={
                <UploadArea {...uploadAreaProps} variant="toolbar" />
              }
            />
          </div>

          {isDocked && wordPanelOpen && <WordPanelDock {...wordPanelProps} />}
        </div>
      )}

      {/* Stop Speech Button — bottom-left so it clears the centre selection toolbar and the right-corner word-panel FAB */}
      {(isSpeaking || isLoadingAudio) && (
        <div className="fixed bottom-6 left-6 z-50 lg:left-[calc(var(--app-sidebar-w)+1.5rem)]">
          <button
            type="button"
            onClick={stopSpeaking}
            disabled={isLoadingAudio}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium border border-error/30 text-error bg-base-100/90 backdrop-blur-xl shadow-floating hover:bg-error/10 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            {isLoadingAudio ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                生成中
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
                停止
              </>
            )}
          </button>
        </div>
      )}

      {/* Word Panel Trigger Button — opens the unified lookup + vocabulary panel */}
      {pdfUrl && !wordPanelOpen && (
        <button
          type="button"
          onClick={openWordPanel}
          className="fixed right-6 bottom-6 z-40 w-12 h-12 rounded-full flex items-center justify-center bg-base-100/90 backdrop-blur-xl border border-border-hairline shadow-floating hover:scale-105 hover:text-accent active:scale-[0.98] transition-all duration-200"
          aria-label="開啟生詞本"
        >
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 2v7l2.5-2L14 9V2" />
            </svg>
            {lookups.length > 0 && (
              <span className="absolute -top-2 -right-2 badge badge-xs badge-accent">
                {lookups.length}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Floating shell — used when the user prefers it, or below the lg breakpoint */}
      {!isDocked && wordPanelOpen && <WordPanel {...wordPanelProps} />}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default PdfReader;
