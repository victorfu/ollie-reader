import { useMemo, useState } from "react";
import { usePdfState } from "../hooks/usePdfState";
import { useSpeechState } from "../hooks/useSpeechState";
import { useTextSelection } from "../hooks/useTextSelection";
import { usePdfWorker } from "../hooks/usePdfWorker";
import { useChat } from "../hooks/useChat";
import { useVocabulary, formatDefinitionsForDisplay } from "../hooks/useVocabulary";
import { UploadArea } from "./PdfReader/UploadArea";
import { TTSControls } from "./PdfReader/TTSControls";
import { FileInfo } from "./PdfReader/FileInfo";
import { PdfViewer } from "./PdfReader/PdfViewer";
import { PageTextArea } from "./PdfReader/PageTextArea";
import { SelectionToolbar } from "./PdfReader/SelectionToolbar";
import { ChatPanel } from "./PdfReader/ChatPanel";
import { Toast } from "./common/Toast";
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
    handleFileChange,
    loadPdfFromUrl,
    cancelUpload,
    clearPdfCache,
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

  const handleLoadBookingPdf = async (record: { id: string }) => {
    if (!bookingToken || !record.id) return;
    setLoadingCourseId(record.id);
    try {
      const url = `https://www.oikid.com/PHP/Review.php?id=${record.id}&token=${bookingToken}`;
      await loadPdfFromUrl(url);
      setDrawerOpen(false);
    } finally {
      // 確保一定會重置 loading 狀態
      setLoadingCourseId(null);
    }
  };

  const [urlInput, setUrlInput] = useState<string>("");
  const [isAddingToVocabulary, setIsAddingToVocabulary] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Vocabulary hook
  const { lookupOrAddWord } = useVocabulary();

  const pagesByNumber = useMemo(() => {
    const map = new Map();
    if (result) {
      for (const p of result.pages) map.set(p.page_number, p);
    }
    return map;
  }, [result]);

  // Get PDF full text for chat context
  const pdfFullText = useMemo(() => {
    if (!result) return "";
    return result.pages.map((p) => p.text).join("\n\n");
  }, [result]);

  // Chat hook
  const {
    messages,
    isLoading: isChatLoading,
    error: chatError,
    sendMessage,
    clearMessages,
  } = useChat(pdfFullText);

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

  // Combined lookup and add to vocabulary - also shows definition
  const handleLookupWord = async () => {
    const trimmedText = selectedText.trim();
    if (!trimmedText) return;

    // Extract the first word if multiple words are selected
    const word = trimmedText.split(/\s+/)[0];

    setIsAddingToVocabulary(true);
    try {
      const response = await lookupOrAddWord(word, {
        sourceContext: trimmedText,
        sourcePdfName: selectedFile?.name,
        sourcePage: undefined,
      });

      if (response.success && response.existingWord) {
        // Format and display the definition
        const formattedDef = formatDefinitionsForDisplay(response.existingWord);
        setTranslatedText(formattedDef || "無定義資料");

        // Show toast message
        if (response.isNew) {
          setToastMessage({
            message: `「${word}」已加入生詞本！`,
            type: "success",
          });
        } else {
          setToastMessage({
            message: `「${word}」已在生詞本中`,
            type: "info",
          });
        }
      } else {
        setToastMessage({
          message: response.message || "查詢失敗",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error looking up word:", error);
      setToastMessage({ message: "查詢單字時發生錯誤", type: "error" });
    } finally {
      setIsAddingToVocabulary(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearPdfCache();
      setToastMessage({
        message: "快取已清除，請重新載入 PDF",
        type: "success",
      });
    } catch (error) {
      console.error("Error clearing cache:", error);
      setToastMessage({ message: "清除快取時發生錯誤", type: "error" });
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div className="w-full relative">
      <style>
        {`
        .react-pdf__Document{width:100%}
        .react-pdf__Page{width:100% !important;max-width:100%}
        .react-pdf__Page canvas,.react-pdf__Page svg{width:100% !important;height:auto !important;max-width:100%;display:block}
        `}
      </style>

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

      {/* TTS Controls */}
      {result && (
        <TTSControls
          ttsMode={ttsMode}
          readingMode={readingMode}
          speechRate={speechRate}
          isSpeaking={isSpeaking}
          isLoadingAudio={isLoadingAudio}
          onTtsModeChange={setTtsMode}
          onReadingModeChange={setReadingMode}
          onStop={stopSpeaking}
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
          isAddingToVocabulary={isAddingToVocabulary}
          position={toolbarPosition}
        />
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* File Info */}
          <FileInfo
            result={result}
            onClearCache={handleClearCache}
            isClearingCache={isClearingCache}
          />

          {/* PDF Viewer - Glass card with macOS HIG styling */}
          {pdfUrl && (
            <div className="rounded-xl border border-black/5 dark:border-white/10 bg-base-100 shadow-lg overflow-hidden">
              <div className="p-0">
                <PdfViewer
                  url={pdfUrl}
                  pagesByNumber={pagesByNumber}
                  readingMode={readingMode}
                  onSpeak={speak}
                  onStopSpeaking={stopSpeaking}
                  onTextSelection={handleTextSelection}
                  isLoadingAudio={isLoadingAudio}
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
                  onStopSpeaking={stopSpeaking}
                  onTextSelection={handleTextSelection}
                  isLoadingAudio={isLoadingAudio}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Chat Panel */}
      <ChatPanel
        messages={messages}
        isLoading={isChatLoading}
        error={chatError}
        onSendMessage={sendMessage}
        onClear={clearMessages}
        disabled={!result}
      />

      {/* Toast Notifications */}
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

export default PdfReader;
