import { useMemo, useRef, useState } from "react";
import { logger } from "../utils/logger";
import { usePdfState } from "../hooks/usePdfState";
import { useSpeechState } from "../hooks/useSpeechState";
import { useSettings } from "../hooks/useSettings";
import { useTextSelection } from "../hooks/useTextSelection";
import { usePdfWorker } from "../hooks/usePdfWorker";
import { useVocabulary, formatDefinitionsForDisplay } from "../hooks/useVocabulary";
import { useLookupQueue } from "../hooks/useLookupQueue";
import { UploadArea } from "./PdfReader/UploadArea";
import { PdfControlBar } from "./PdfReader/PdfControlBar";
import { PdfViewer } from "./PdfReader/PdfViewer";
import { PageTextArea } from "./PdfReader/PageTextArea";
import { SelectionToolbar } from "./PdfReader/SelectionToolbar";
import { FloatingStopButton } from "./PdfReader/FloatingStopButton";
import { LookupPanel } from "./PdfReader/LookupPanel";
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
    isLoadingFromUrl,
    initialScrollPosition,
    handleFileChange,
    loadPdfFromUrl,
    cancelUpload,
    clearPdfCache,
    saveScrollPosition,
  } = usePdfState();

  const {
    speechRate,
    isSpeaking,
    ttsMode,
    setTtsMode,
    isLoadingAudio,
    speechSupported,
    speak,
    stopSpeaking,
  } = useSpeechState();

  const { textParsingMode } = useSettings();

  const {
    readingMode,
    setReadingMode,
    selectedText,
    translatedText,
    isTranslating,
    translateError,
    handleTextSelection,
    translateText,
    clearSelection,
    setTranslatedText,
    toolbarPosition,
  } = useTextSelection(selectedFile?.name);

  const {
    bookingRecords,
    token: bookingToken,
    isLoading: isLoadingBookingRecords,
    error: bookingRecordsError,
    fetchBookingRecords,
  } = useBookingRecords();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);

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

  const [urlInput, setUrlInput] = useState<string>("");
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Toast queue for multiple notifications
  const { toasts, addToast, removeToast } = useToastQueue(3);

  // Vocabulary hook
  const { lookupOrAddWord } = useVocabulary();
  const { lookups, startLookup, dismissLookup, dismissAll } = useLookupQueue(
    lookupOrAddWord,
    formatDefinitionsForDisplay,
  );

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

    const word = trimmedText.split(/\s+/)[0];
    const result = startLookup(word, {
      sourceContext: trimmedText,
      sourcePdfName: selectedFile?.name,
    });

    if (result === "duplicate") {
      addToast(`「${word}」正在查詢中`, "info");
    } else if (result === "max_reached") {
      addToast("同時查詢數量已達上限", "error");
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

  return (
    <div className="w-full relative">

      {/* Upload Area + 課程紀錄按鈕 */}
      <div className="relative">
        <UploadArea
          selectedFile={selectedFile}
          isUploading={isUploading}
          isLoadingFromUrl={isLoadingFromUrl}
          urlInput={urlInput}
          speechSupported={speechSupported}
          onFileChange={onInputChange}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onUrlChange={setUrlInput}
          onUrlLoad={loadPdfFromUrl}
          onCancel={cancelUpload}
          onOpenBookingDrawer={() => setDrawerOpen(true)}
        />
      </div>

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

      {/* PDF Control Bar */}
      {result && (
        <PdfControlBar
          ttsMode={ttsMode}
          readingMode={readingMode}
          speechRate={speechRate}
          isSpeaking={isSpeaking}
          isLoadingAudio={isLoadingAudio}
          onTtsModeChange={setTtsMode}
          onReadingModeChange={setReadingMode}
          onStop={stopSpeaking}
          result={result}
          onClearCache={handleClearCache}
          isClearingCache={isClearingCache}
        />
      )}

      {/* Error Alert - macOS HIG style */}
      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 mb-6">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Selection Toolbar */}
      {readingMode === "selection" && result && (
        <SelectionToolbar
          selectedText={selectedText}
          translatedText={translatedText}
          isTranslating={isTranslating}
          translateError={translateError}
          onSpeak={speakSelection}
          onTranslate={translateText}
          onClear={clearSelection}
          onClearTranslation={() => setTranslatedText("")}
          onAddToVocabulary={handleLookupWord}
          position={toolbarPosition}
        />
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* PDF Viewer - Glass card with macOS HIG styling */}
          {pdfUrl && (
            <div className="rounded-xl border border-black/5 dark:border-white/10 bg-base-100 shadow-lg overflow-hidden">
              <div className="p-0">
                <PdfViewer
                  url={pdfUrl}
                  pagesByNumber={pagesByNumber}
                  readingMode={readingMode}
                  onSpeak={speak}
                  onTextSelection={handleTextSelection}
                  isLoadingAudio={isLoadingAudio}
                  isSpeaking={isSpeaking}
                  initialScrollPosition={initialScrollPosition}
                  onScrollPositionChange={saveScrollPosition}
                  textParsingMode={textParsingMode}
                />
              </div>
            </div>
          )}

          {/* All Pages Overview (when no PDF URL) */}
          {!pdfUrl && (
            <div className="space-y-6">
              {result.pages.map((p) => (
                <PageTextArea
                  key={p.page_number}
                  pageNumber={p.page_number}
                  text={p.text || ""}
                  readingMode={readingMode}
                  onSpeak={speak}
                  onTextSelection={handleTextSelection}
                  isLoadingAudio={isLoadingAudio}
                  isSpeaking={isSpeaking}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lookup Queue Panel */}
      <LookupPanel
        lookups={lookups}
        onDismiss={dismissLookup}
        onDismissAll={dismissAll}
        onSpeak={speak}
        hasStopButton={isSpeaking || isLoadingAudio}
      />

      {/* Floating Stop Button */}
      <FloatingStopButton
        isSpeaking={isSpeaking}
        isLoadingAudio={isLoadingAudio}
        onStop={stopSpeaking}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default PdfReader;
