import { useEffect, useState, useCallback, useRef } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Trash2, Volume2 } from "lucide-react";
import { useSentenceTranslation } from "../../hooks/useSentenceTranslation";
import { useSpeechState } from "../../hooks/useSpeechState";
import { useDebounce } from "../../hooks/useDebounce";
import type { SentenceTranslation } from "../../types/sentenceTranslation";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";
import {
  toolbarFieldClass,
  toolbarPrimaryButtonClass,
} from "../common/toolbarStyles";

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
  const rootClassName = embedded
    ? "flex h-full min-h-0 flex-col"
    : "mx-auto max-w-4xl";
  const contentClassName = embedded
    ? "mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide"
    : "";
  const listSpacingClassName = embedded ? "space-y-4" : "space-y-8";
  // Responsive auto-fill grid: cards flow into as many ~18rem columns as fit,
  // collapsing to a single column on narrow screens. Avoids short phrases
  // stretching across the full content width.
  const cardGridClassName = embedded
    ? "grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-2"
    : "grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3";
  const emptyStateClassName = embedded
    ? "rounded-xl surface-card p-6 text-center"
    : "py-20 text-center";

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
    <div className={rootClassName}>
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

      <div
        className={
          embedded ? "shrink-0 space-y-2" : "mb-6 space-y-3 rounded-xl surface-card p-3"
        }
      >
        {/* Manual sentence input */}
        <form
          className="flex min-w-0 gap-2"
          onSubmit={handleManualSubmit}
        >
          <input
            id={manualSentenceFieldId}
            type="text"
            placeholder="手動輸入英文句子"
            className={`${toolbarFieldClass} flex-1`}
            value={manualSentence}
            onChange={(e) => setManualSentence(e.target.value)}
            disabled={isSubmittingManualSentence}
            autoComplete="off"
          />
          <button
            type="submit"
            className={toolbarPrimaryButtonClass}
            disabled={
              isSubmittingManualSentence || manualSentence.trim().length === 0
            }
          >
            {isSubmittingManualSentence ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              embedded ? "翻譯" : "翻譯並加入"
            )}
          </button>
        </form>

        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="搜尋句子..."
            className={`${toolbarFieldClass} w-full pl-9`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className={contentClassName}>
        {isLoading && sentences.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : sentences.length === 0 ? (
          <div className={emptyStateClassName}>
            <div className={embedded ? "mb-2 text-4xl" : "mb-4 text-6xl"}>
              📝
            </div>
            <h3 className="mb-2 text-lg font-semibold">還沒有翻譯過的句子</h3>
            <p className="text-sm text-muted-foreground">
              在閱讀器中選取句子並點擊翻譯，句子就會自動儲存在這裡
            </p>
          </div>
        ) : filteredSentences.length === 0 ? (
          <div className={emptyStateClassName}>
            <div className={embedded ? "mb-2 text-3xl" : "mb-4 text-4xl"}>
              🔍
            </div>
            <p className="text-sm text-muted-foreground">找不到符合的句子</p>
          </div>
        ) : (
          <div className={listSpacingClassName}>
            {dateKeys.map((date) => (
              <div key={date}>
                <h2 className="sticky top-0 z-10 mb-1 flex items-center gap-2 rounded-lg toolbar px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-accent/60" />
                  {date}
                  <span className="rounded-full bg-base-200 px-1.5 py-0.5 text-[10px] font-normal">
                    {groupedSentences[date].length}
                  </span>
                </h2>
                <div className={cardGridClassName}>
                  <AnimatePresence mode="popLayout">
                    {groupedSentences[date].map((sentence) => (
                      <motion.div
                        key={sentence.id}
                        layout
                        initial={{ opacity: 0, y: embedded ? 8 : 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`group rounded-lg transition-colors ${
                          embedded
                            ? "border border-border-hairline bg-background/70 shadow-soft hover:bg-background"
                            : "surface-card"
                        }`}
                      >
                        <div className={embedded ? "p-3" : "p-4"}>
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => handleSpeak(sentence.english)}
                              className="btn btn-ghost btn-xs btn-circle mt-0.5 shrink-0 text-accent/70 hover:text-accent"
                              title="朗讀"
                              aria-label="朗讀句子"
                            >
                              <Volume2
                                className="size-4"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p
                                className={
                                  embedded
                                    ? "text-sm font-medium leading-6"
                                    : "text-base leading-relaxed"
                                }
                              >
                                {sentence.english}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {sentence.chinese}
                              </p>
                              {sentence.sourcePdfName && (
                                <p className="mt-1 truncate text-xs text-muted-foreground/70">
                                  來源：{sentence.sourcePdfName}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setDeleteId(sentence.id!)}
                              className="btn btn-ghost btn-xs btn-circle shrink-0 text-error/60 opacity-0 transition-opacity hover:text-error group-hover:opacity-100 focus:opacity-100"
                              title="刪除"
                              aria-label="刪除句子"
                            >
                              <Trash2
                                className="size-4"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}

            {/* Load more trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-6">
                {isLoading && (
                  <span className="loading loading-spinner loading-md text-primary" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

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
