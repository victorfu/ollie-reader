import { useMemo, useState } from "react";
import { usePdfState } from "../hooks/usePdfState";
import { useSpeechState } from "../hooks/useSpeechState";
import { useTextSelection } from "../hooks/useTextSelection";
import { usePdfWorker } from "../hooks/usePdfWorker";
import { useChat } from "../hooks/useChat";
import { useVocabulary } from "../hooks/useVocabulary";
import { UploadArea } from "./PdfReader/UploadArea";
import { TTSControls } from "./PdfReader/TTSControls";
import { FileInfo } from "./PdfReader/FileInfo";
import { PdfViewer } from "./PdfReader/PdfViewer";
import { PageTextArea } from "./PdfReader/PageTextArea";
import { SelectionToolbar } from "./PdfReader/SelectionToolbar";
import { ChatPanel } from "./PdfReader/ChatPanel";
import { Toast } from "./common/Toast";
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
  } = usePdfState();

  const {
    speechRate,
    setSpeechRate,
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
  } = useTextSelection();

  const { bookingRecords, token: bookingToken } = useBookingRecords();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);

  const handleLoadBookingPdf = async (record: { id: string }) => {
    if (!bookingToken || !record.id) return;
    setLoadingCourseId(record.id);
    const url = `https://www.oikid.com/PHP/Review.php?id=${record.id}&token=${bookingToken}`;
    await loadPdfFromUrl(url);
    setDrawerOpen(false);
    setLoadingCourseId(null);
  };

  const [urlInput, setUrlInput] = useState<string>("");
  const [isAddingToVocabulary, setIsAddingToVocabulary] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Vocabulary hook
  const { addWord } = useVocabulary();

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

  const handleAddToVocabulary = async () => {
    if (!selectedText.trim()) return;

    // Extract the first word if multiple words are selected
    const word = selectedText.trim().split(/\s+/)[0];

    setIsAddingToVocabulary(true);
    try {
      const response = await addWord(word, {
        sourceContext: selectedText,
        sourcePdfName: selectedFile?.name,
        sourcePage: undefined, // You can track current page if needed
      });

      if (response.success) {
        setToastMessage({
          message: `"${word}" 已加入生詞本！`,
          type: "success",
        });
      } else {
        setToastMessage({
          message: response.message || "加入失敗",
          type: "info",
        });
      }
    } catch (error) {
      console.error("Error adding to vocabulary:", error);
      setToastMessage({ message: "加入生詞本時發生錯誤", type: "error" });
    } finally {
      setIsAddingToVocabulary(false);
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

      {/* Drawer：右側浮出，不遮住主畫面，可互動 */}
      {drawerOpen && (
        <div className="fixed top-0 right-0 h-full z-50 flex flex-col pointer-events-none">
          <div
            className="absolute top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto z-50 pointer-events-auto"
            style={{ maxWidth: 320 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">課程預約紀錄</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setDrawerOpen(false)}
                aria-label="關閉"
              >
                ✕
              </button>
            </div>
            {bookingRecords.length === 0 ? (
              <div className="text-gray-500">目前沒有課程紀錄</div>
            ) : (
              <ul className="space-y-3">
                {bookingRecords.map((record) => (
                  <li key={record.id}>
                    <button
                      className={`w-full text-left p-3 rounded border flex flex-col hover:bg-blue-50 transition ${
                        loadingCourseId === record.id
                          ? "opacity-60 pointer-events-none"
                          : ""
                      }`}
                      onClick={() => handleLoadBookingPdf(record)}
                      disabled={loadingCourseId === record.id}
                    >
                      <span className="font-semibold text-base">
                        {record.CoursesName}
                      </span>
                      <span className="text-sm text-gray-600">
                        {record.ClassTime}
                      </span>
                      <span className="text-sm text-gray-500">
                        教師：{record.TeacherName}
                      </span>
                      {loadingCourseId === record.id && (
                        <span className="text-blue-600 mt-1">載入中...</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
          onSpeechRateChange={setSpeechRate}
          onStop={stopSpeaking}
        />
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error shadow-lg mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
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
          onAddToVocabulary={handleAddToVocabulary}
          isAddingToVocabulary={isAddingToVocabulary}
        />
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* File Info */}
          <FileInfo result={result} />

          {/* PDF Viewer */}
          {pdfUrl && (
            <div className="card bg-base-100 shadow-xl h-full">
              <div className="card-body p-0">
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
                  textLength={p.text_length}
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
