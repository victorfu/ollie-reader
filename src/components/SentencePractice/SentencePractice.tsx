import { useState, useRef, useEffect, useCallback } from "react";
import { Reorder } from "framer-motion";
import { useSentencePractice } from "../../hooks/useSentencePractice";
import { useSpeechState } from "../../hooks/useSpeechState";
import { SentenceInput } from "./SentenceInput";
import { SentenceCard } from "./SentenceCard";
import { SimpleTTSControls } from "../common/SimpleTTSControls";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";
import type { PracticeSentence } from "../../types/sentencePractice";

export const SentencePractice = () => {
  const {
    sentences,
    setSentences,
    loading,
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

  const {
    speechSupported,
    speechRate,
    setSpeechRate,
    isSpeaking,
    ttsMode,
    setTtsMode,
    isLoadingAudio,
    stopSpeaking,
    speak,
  } = useSpeechState();

  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
      speak(sentences[i].english);

      // Wait for the current sentence to finish
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (playAllRef.current.cancelled) {
            clearInterval(checkInterval);
            resolve();
            return;
          }
          // Check if speaking has stopped (isSpeaking becomes false)
          // We need to wait a bit after speak() is called before checking
        }, 100);

        // Also set a timeout based on text length as a fallback
        const estimatedDuration = Math.max(
          2000,
          sentences[i].english.length * 80,
        );
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, estimatedDuration);
      });

      // Small pause between sentences
      if (!playAllRef.current.cancelled && i < sentences.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setIsPlayingAll(false);
    setCurrentPlayingIndex(-1);
  }, [sentences, isPlayingAll, speak, stopSpeaking]);

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
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                ✍️ 句子練習
              </h1>
              <p className="text-base-content/60 mt-1">
                貼上英文段落，一句一句練習閱讀與發音
              </p>
            </div>
            {sentences.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePlayAll}
                  disabled={isLoadingAudio}
                  className={`btn btn-sm ${
                    isPlayingAll ? "btn-warning" : "btn-primary"
                  }`}
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
                      停止播放
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
                      播放全部
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="btn btn-outline btn-error btn-sm"
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
                  清除全部
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TTS Controls */}
      {speechSupported && (
        <div className="mb-6">
          <SimpleTTSControls
            ttsMode={ttsMode}
            speechRate={speechRate}
            isSpeaking={isSpeaking}
            isLoadingAudio={isLoadingAudio}
            onTtsModeChange={setTtsMode}
            onSpeechRateChange={setSpeechRate}
            onStop={stopSpeaking}
          />
        </div>
      )}

      {/* Input Area */}
      <SentenceInput onSubmit={handleSubmit} isProcessing={isProcessing} />

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
                <Reorder.Item
                  key={sentence.id}
                  value={sentence}
                  onDragEnd={handleReorderComplete}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <SentenceCard
                    sentence={sentence}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    getWordDefinition={getWordDefinition}
                    isProcessing={isProcessing}
                    isCurrentlyPlaying={
                      isPlayingAll && currentPlayingIndex === index
                    }
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="btn btn-outline btn-primary"
                >
                  {loading ? (
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
    </div>
  );
};

export default SentencePractice;
