import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import {
  Reorder,
  useDragControls,
  AnimatePresence,
  motion,
} from "framer-motion";
import { useSentencePractice } from "../../hooks/useSentencePractice";
import { useSpeechState } from "../../hooks/useSpeechState";
import { SentenceInput } from "./SentenceInput";
import { SentenceCard } from "./SentenceCard";
import { ClickableWords } from "./ClickableWords";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";
import type { PracticeSentence } from "../../types/sentencePractice";

// Wrapper component to handle individual drag controls for each sentence
interface ReorderableSentenceCardProps {
  sentence: PracticeSentence;
  onEdit: (
    id: string,
    newEnglish: string,
  ) => Promise<{ success: boolean; message?: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; message?: string }>;
  getWordDefinition: (word: string) => Promise<string | null>;
  isProcessing: boolean;
  isCurrentlyPlaying: boolean;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
  onDragEnd: () => void;
}

const ReorderableSentenceCard = forwardRef<
  HTMLDivElement,
  ReorderableSentenceCardProps
>(
  (
    {
      sentence,
      onEdit,
      onDelete,
      getWordDefinition,
      isProcessing,
      isCurrentlyPlaying,
      isEditing,
      onEditingChange,
      onDragEnd,
    },
    ref,
  ) => {
    const dragControls = useDragControls();

    return (
      <div ref={ref}>
        <Reorder.Item
          key={sentence.id}
          value={sentence}
          onDragEnd={onDragEnd}
          dragListener={false}
          dragControls={dragControls}
          drag={!isEditing}
        >
          <SentenceCard
            sentence={sentence}
            onEdit={onEdit}
            onDelete={onDelete}
            getWordDefinition={getWordDefinition}
            isProcessing={isProcessing}
            isCurrentlyPlaying={isCurrentlyPlaying}
            onEditingChange={onEditingChange}
            dragControls={dragControls}
          />
        </Reorder.Item>
      </div>
    );
  },
);

export const SentencePractice = () => {
  const {
    sentences,
    setSentences,
    loading,
    isLoadingMore,
    isProcessing,
    hasMore,
    loadMore,
    parseAndTranslate,
    editSentence,
    deleteSentence,
    clearAll,
    getWordDefinition,
    reorderSentences,
  } = useSentencePractice();

  const { isLoadingAudio, stopSpeaking, speakAsync } = useSpeechState();

  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showInputPanel, setShowInputPanel] = useState(false);

  // Track which sentence is being edited to disable drag
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(
    null,
  );

  // Play all sentences state
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(-1);
  const playAllRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Play all sentences sequentially
  const handlePlayAll = useCallback(async () => {
    if (sentences.length === 0) return;

    // If already playing, stop
    if (isPlayingAll) {
      playAllRef.current.cancelled = true;
      stopSpeaking();
      setIsPlayingAll(false);
      setCurrentPlayingIndex(-1);
      return;
    }

    setIsPlayingAll(true);
    playAllRef.current.cancelled = false;

    for (let i = 0; i < sentences.length; i++) {
      if (playAllRef.current.cancelled) break;

      setCurrentPlayingIndex(i);

      try {
        // Use speakAsync to wait for the actual speech to finish
        await speakAsync(sentences[i].english);
      } catch (err) {
        console.error("Speech error:", err);
      }

      // Small pause between sentences
      if (!playAllRef.current.cancelled && i < sentences.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setIsPlayingAll(false);
    setCurrentPlayingIndex(-1);
  }, [sentences, isPlayingAll, speakAsync, stopSpeaking]);

  // Manual navigation during playback
  const handlePrevSentence = useCallback(() => {
    if (!isPlayingAll || currentPlayingIndex <= 0) return;
    stopSpeaking();
    const newIndex = currentPlayingIndex - 1;
    setCurrentPlayingIndex(newIndex);
    speakAsync(sentences[newIndex].english);
  }, [isPlayingAll, currentPlayingIndex, sentences, stopSpeaking, speakAsync]);

  const handleNextSentence = useCallback(() => {
    if (!isPlayingAll || currentPlayingIndex >= sentences.length - 1) return;
    stopSpeaking();
    const newIndex = currentPlayingIndex + 1;
    setCurrentPlayingIndex(newIndex);
    speakAsync(sentences[newIndex].english);
  }, [isPlayingAll, currentPlayingIndex, sentences, stopSpeaking, speakAsync]);

  // Cleanup on unmount
  useEffect(() => {
    const ref = playAllRef.current;
    return () => {
      ref.cancelled = true;
    };
  }, []);

  // Handle reorder with optimistic update and Firestore persistence
  const handleReorder = async (reorderedList: PracticeSentence[]) => {
    // Update local state immediately for smooth drag experience
    setSentences(reorderedList);
  };

  // Save order to Firestore when drag ends
  const handleReorderComplete = async () => {
    const result = await reorderSentences(sentences);
    if (!result.success) {
      setToastMessage({
        message: result.message || "排序儲存失敗",
        type: "error",
      });
    }
  };

  const handleSubmit = async (text: string) => {
    const result = await parseAndTranslate(text);

    if (result.success) {
      setToastMessage({
        message: result.message || "成功",
        type: "success",
      });
    } else {
      setToastMessage({
        message: result.message || "處理失敗",
        type: "error",
      });
    }
  };

  const handleEdit = async (id: string, newEnglish: string) => {
    const result = await editSentence(id, newEnglish);

    if (result.success) {
      setToastMessage({
        message: "句子已更新",
        type: "success",
      });
    } else {
      setToastMessage({
        message: result.message || "更新失敗",
        type: "error",
      });
    }

    return result;
  };

  const handleDelete = async (id: string) => {
    const result = await deleteSentence(id);

    if (result.success) {
      setToastMessage({
        message: "句子已刪除",
        type: "info",
      });
    } else {
      setToastMessage({
        message: result.message || "刪除失敗",
        type: "error",
      });
    }

    return result;
  };

  const handleClearAll = async () => {
    const result = await clearAll();
    setShowClearConfirm(false);

    if (result.success) {
      setToastMessage({
        message: "已清除所有句子",
        type: "info",
      });
    } else {
      setToastMessage({
        message: result.message || "清除失敗",
        type: "error",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Header */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                ✍️ 英文演講
              </h1>
              <p className="text-base-content/60 mt-1">
                貼上英文段落，一句一句練習閱讀與發音
              </p>
            </div>
            {sentences.length > 0 && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const allSentences = sentences
                      .map((s) => s.english)
                      .join("\n");
                    navigator.clipboard.writeText(allSentences).then(() => {
                      setToastMessage({
                        message: "已複製所有句子",
                        type: "success",
                      });
                    });
                  }}
                  className="btn btn-sm btn-outline btn-secondary"
                  title="複製全部"
                >
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
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="hidden sm:inline">複製全部</span>
                </button>
                <button
                  type="button"
                  onClick={handlePlayAll}
                  disabled={isLoadingAudio}
                  className={`btn btn-sm ${
                    isPlayingAll ? "btn-warning" : "btn-primary"
                  }`}
                  title={isPlayingAll ? "停止播放" : "播放全部"}
                >
                  {isPlayingAll ? (
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
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                        />
                      </svg>
                      <span className="hidden sm:inline">停止播放</span>
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
                          strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="hidden sm:inline">播放全部</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="btn btn-outline btn-error btn-sm"
                  title="清除全部"
                >
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
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span className="hidden sm:inline">清除全部</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Sentence Button */}
      {!showInputPanel && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowInputPanel(true)}
            className="btn btn-primary w-full"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            新增句子
          </button>
        </div>
      )}

      {/* Input Area */}
      <SentenceInput
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        isOpen={showInputPanel}
        onClose={() => setShowInputPanel(false)}
      />

      {/* Sentence List */}
      <div className="space-y-4">
        {loading && sentences.length === 0 ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : sentences.length === 0 ? (
          <div className="card bg-base-100 shadow-md">
            <div className="card-body items-center text-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-base-content/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-base-content/60 mt-4">
                還沒有句子
              </h3>
              <p className="text-sm text-base-content/40">
                在上方輸入英文文字開始練習
              </p>
            </div>
          </div>
        ) : (
          <>
            <Reorder.Group
              axis="y"
              values={sentences}
              onReorder={handleReorder}
              className="space-y-4"
            >
              {sentences.map((sentence, index) => (
                <ReorderableSentenceCard
                  key={sentence.id}
                  sentence={sentence}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  getWordDefinition={getWordDefinition}
                  isProcessing={isProcessing}
                  isCurrentlyPlaying={
                    isPlayingAll && currentPlayingIndex === index
                  }
                  isEditing={editingSentenceId === sentence.id}
                  onEditingChange={(isEditing) =>
                    setEditingSentenceId(isEditing ? sentence.id! : null)
                  }
                  onDragEnd={handleReorderComplete}
                />
              ))}
            </Reorder.Group>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="btn btn-outline btn-primary"
                >
                  {isLoadingMore ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      載入中...
                    </>
                  ) : (
                    "載入更多"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear All Confirm Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="清除所有句子"
        message="確定要刪除所有句子嗎？此操作無法復原。"
        confirmText="清除全部"
        cancelText="取消"
        confirmVariant="error"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Fullscreen Playback Overlay */}
      <AnimatePresence>
        {isPlayingAll &&
          currentPlayingIndex >= 0 &&
          sentences[currentPlayingIndex] && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-50 bg-base-200/95 backdrop-blur-sm flex flex-col"
            >
              {/* Header with progress */}
              <div className="flex justify-between items-center p-4 sm:p-6">
                <div className="text-lg sm:text-xl font-medium text-base-content/70">
                  {currentPlayingIndex + 1} / {sentences.length}
                </div>
                <button
                  type="button"
                  onClick={handlePlayAll}
                  className="btn btn-circle btn-ghost btn-lg"
                  title="關閉"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Main content - centered sentence */}
              <div className="flex-1 flex items-center justify-center px-4 sm:px-8 md:px-16">
                <motion.div
                  key={currentPlayingIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-center max-w-4xl w-full"
                >
                  {/* English sentence - maximized */}
                  <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-base-content leading-relaxed mb-6 sm:mb-8">
                    <ClickableWords
                      text={sentences[currentPlayingIndex].english}
                      getWordDefinition={getWordDefinition}
                    />
                  </div>
                  {/* Chinese translation */}
                  <p className="text-lg sm:text-xl md:text-2xl text-base-content/60">
                    {sentences[currentPlayingIndex].chinese}
                  </p>
                </motion.div>
              </div>

              {/* Navigation controls */}
              <div className="flex justify-center items-center gap-4 p-6 sm:p-8">
                {/* Previous button */}
                <button
                  type="button"
                  onClick={handlePrevSentence}
                  disabled={currentPlayingIndex <= 0}
                  className="btn btn-circle btn-ghost btn-lg disabled:opacity-30"
                  title="上一句"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Stop button (center) */}
                <button
                  type="button"
                  onClick={handlePlayAll}
                  className="btn btn-circle btn-warning btn-xl shadow-xl"
                  title="停止播放"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>

                {/* Next button */}
                <button
                  type="button"
                  onClick={handleNextSentence}
                  disabled={currentPlayingIndex >= sentences.length - 1}
                  className="btn btn-circle btn-ghost btn-lg disabled:opacity-30"
                  title="下一句"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Fixed floating stop button (fallback for when overlay isn't visible) */}
      {isPlayingAll && (
        <button
          type="button"
          onClick={handlePlayAll}
          className="fixed bottom-6 right-6 btn btn-circle btn-lg btn-warning shadow-2xl z-40 sm:hidden"
          title="停止播放"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SentencePractice;
