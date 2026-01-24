import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSentenceTranslation } from "../../hooks/useSentenceTranslation";
import { useSpeechState } from "../../hooks/useSpeechState";
import { useDebounce } from "../../hooks/useDebounce";
import type { SentenceTranslation } from "../../types/sentenceTranslation";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";

// Group sentences by date
const groupSentencesByDate = (sentences: SentenceTranslation[]) => {
  const groups: { [key: string]: SentenceTranslation[] } = {};

  sentences.forEach((sentence) => {
    const date = new Date(sentence.createdAt).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(sentence);
  });

  return groups;
};

export const SentenceTranslationBook = () => {
  const {
    sentences,
    isLoading,
    hasMore,
    error,
    loadSentences,
    loadMore,
    deleteSentence,
    clearAll,
  } = useSentenceTranslation();

  const { speak, isSpeaking, stopSpeaking } = useSpeechState();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load sentences on mount
  useEffect(() => {
    loadSentences();
  }, [loadSentences]);

  // Show error as toast
  useEffect(() => {
    if (error) {
      setToastMessage({ message: error, type: "error" });
    }
  }, [error]);

  // Filter sentences by search query
  const filteredSentences = debouncedSearchQuery
    ? sentences.filter(
        (s) =>
          s.english.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          s.chinese.includes(debouncedSearchQuery)
      )
    : sentences;

  const groupedSentences = groupSentencesByDate(filteredSentences);
  const dateKeys = Object.keys(groupedSentences);

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    await deleteSentence(deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    setToastMessage({ message: "已刪除", type: "success" });
  }, [deleteId, deleteSentence]);

  // Handle clear all
  const handleClearAll = useCallback(async () => {
    setIsClearing(true);
    await clearAll();
    setIsClearing(false);
    setShowClearConfirm(false);
    setToastMessage({ message: "已清除所有翻譯", type: "success" });
  }, [clearAll]);

  // Handle speak
  const handleSpeak = useCallback(
    (text: string) => {
      if (isSpeaking) {
        stopSpeaking();
      } else {
        speak(text);
      }
    },
    [isSpeaking, stopSpeaking, speak]
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            句子翻譯
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            {sentences.length} 個已翻譯句子
          </p>
        </div>

        {sentences.length > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-error btn-sm"
            onClick={() => setShowClearConfirm(true)}
          >
            清除全部
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-base-content/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="搜尋句子..."
            className="input input-bordered w-full pl-10 bg-base-100/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {isLoading && sentences.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : sentences.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold mb-2">還沒有翻譯過的句子</h3>
          <p className="text-base-content/60">
            在閱讀器中選取句子並點擊翻譯，句子就會自動儲存在這裡
          </p>
        </div>
      ) : filteredSentences.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-base-content/60">找不到符合的句子</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dateKeys.map((date) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-base-content/50 mb-3 sticky top-14 bg-base-200/95 backdrop-blur-sm py-2 -mx-2 px-2 z-10">
                {date}
              </h2>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {groupedSentences[date].map((sentence) => (
                    <motion.div
                      key={sentence.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="card bg-base-100 border border-black/5 dark:border-white/10 shadow-sm"
                    >
                      <div className="card-body p-4">
                        {/* English */}
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleSpeak(sentence.english)}
                            className="btn btn-ghost btn-sm btn-circle shrink-0 mt-0.5"
                            title="朗讀"
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
                                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                              />
                            </svg>
                          </button>
                          <p className="text-base leading-relaxed flex-1">
                            {sentence.english}
                          </p>
                          <button
                            type="button"
                            onClick={() => setDeleteId(sentence.id!)}
                            className="btn btn-ghost btn-sm btn-circle shrink-0 text-base-content/40 hover:text-error"
                            title="刪除"
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
                                strokeWidth={1.5}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>

                        {/* Chinese translation */}
                        <p className="text-sm text-base-content/70 pl-11">
                          {sentence.chinese}
                        </p>

                        {/* Source PDF */}
                        {sentence.sourcePdfName && (
                          <p className="text-xs text-base-content/40 pl-11 mt-1">
                            來源：{sentence.sourcePdfName}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}

          {/* Load more trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isLoading && (
                <span className="loading loading-spinner loading-md text-primary" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="刪除句子"
        message="確定要刪除這個句子嗎？"
        confirmText="刪除"
        confirmVariant="error"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Clear All Confirm Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="清除全部"
        message="確定要清除所有已翻譯的句子嗎？此操作無法復原。"
        confirmText="清除全部"
        confirmVariant="error"
        isLoading={isClearing}
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <Toast
            message={toastMessage.message}
            type={toastMessage.type}
            onClose={() => setToastMessage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SentenceTranslationBook;
