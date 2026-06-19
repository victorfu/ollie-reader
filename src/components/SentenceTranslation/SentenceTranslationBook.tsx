import { useEffect, useState, useCallback, useRef } from "react";
import type { FormEvent } from "react";
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

interface SentenceTranslationBookProps {
  embedded?: boolean;
  onCountChange?: (count: number) => void;
}

export const SentenceTranslationBook = ({ embedded = false, onCountChange }: SentenceTranslationBookProps) => {
  const {
    sentences,
    isLoading,
    hasMore,
    error,
    loadSentences,
    loadMore,
    translateText,
    deleteSentence,
  } = useSentenceTranslation();

  const { speak, isSpeaking, stopSpeaking } = useSpeechState();

  const [searchQuery, setSearchQuery] = useState("");
  const [manualSentence, setManualSentence] = useState("");
  const [isSubmittingManualSentence, setIsSubmittingManualSentence] =
    useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const manualSentenceFieldId = "manual-sentence-input";

  // Load sentences on mount
  useEffect(() => {
    loadSentences();
  }, [loadSentences]);

  // Show error as toast
  const [prevError, setPrevError] = useState(error);
  if (prevError !== error) {
    setPrevError(error);
    if (error) {
      setToastMessage({ message: error, type: "error" });
    }
  }

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

  // Report count changes to parent
  useEffect(() => {
    onCountChange?.(sentences.length);
  }, [sentences.length, onCountChange]);

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

  const handleManualSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedSentence = manualSentence.trim();
      if (!trimmedSentence || isSubmittingManualSentence) return;

      setIsSubmittingManualSentence(true);
      try {
        const result = await translateText(trimmedSentence);
        if (!result) {
          setToastMessage({ message: "翻譯失敗，請稍後再試", type: "error" });
          return;
        }

        if (result.fromCache) {
          setToastMessage({ message: "句子已存在翻譯本", type: "info" });
        } else {
          setToastMessage({ message: "句子已加入翻譯本", type: "success" });
          setManualSentence("");
        }

        await loadSentences();
      } catch {
        setToastMessage({ message: "翻譯失敗，請稍後再試", type: "error" });
      } finally {
        setIsSubmittingManualSentence(false);
      }
    },
    [isSubmittingManualSentence, loadSentences, manualSentence, translateText]
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header — only in standalone mode */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              句子翻譯
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sentences.length} 個已翻譯句子
            </p>
          </div>
        </div>
      )}

      {/* Manual sentence input */}
      <div className="surface-card rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-center">
        <form
          className="flex flex-1 min-w-0 gap-2 items-center"
          onSubmit={handleManualSubmit}
        >
          <input
            id={manualSentenceFieldId}
            type="text"
            placeholder="手動輸入英文句子"
            className="input input-bordered flex-1 min-w-[12rem]"
            value={manualSentence}
            onChange={(e) => setManualSentence(e.target.value)}
            disabled={isSubmittingManualSentence}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary active:scale-[0.98]"
            disabled={
              isSubmittingManualSentence || manualSentence.trim().length === 0
            }
          >
            {isSubmittingManualSentence ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "翻譯並加入"
            )}
          </button>
        </form>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"
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
            className="input input-bordered w-full pl-10"
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
          <p className="text-muted-foreground">
            在閱讀器中選取句子並點擊翻譯，句子就會自動儲存在這裡
          </p>
        </div>
      ) : filteredSentences.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-muted-foreground">找不到符合的句子</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dateKeys.map((date) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 sticky top-14 toolbar rounded-lg py-2 -mx-2 px-2 z-10">
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
                      className="card surface-card rounded-xl"
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
                        <p className="text-sm text-muted-foreground pl-11">
                          {sentence.chinese}
                        </p>

                        {/* Source PDF */}
                        {sentence.sourcePdfName && (
                          <p className="text-xs text-muted-foreground pl-11 mt-1">
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
