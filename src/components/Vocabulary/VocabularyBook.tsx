import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { useVocabulary } from "../../hooks/useVocabulary";
import { useSpeechState } from "../../hooks/useSpeechState";
import { useDebounce } from "../../hooks/useDebounce";
import type {
  VocabularyWord,
  VocabularyFilters,
  ReviewSettings,
} from "../../types/vocabulary";
import { WordDetail } from "../Vocabulary/WordDetail";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";

import { FlashcardMode } from "./FlashcardMode";
import { ReviewSettingsModal } from "./ReviewSettingsModal";
import { SentenceTranslationBook } from "../SentenceTranslation/SentenceTranslationBook";
import { VocabularyRow } from "./VocabularyRow";
import { WordDetailPanel } from "./WordDetailPanel";
import { useIsDesktop } from "../../hooks/useMediaQuery";

// Move groupWordsByDate outside component to prevent recreation on each render
const groupWordsByDate = (words: VocabularyWord[]) => {
  const groups: { [key: string]: VocabularyWord[] } = {};

  words.forEach((word) => {
    const date = new Date(word.createdAt).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(word);
  });

  return groups;
};

const DEFAULT_FILTERS: VocabularyFilters = {
  sortBy: "createdAt",
  sortOrder: "desc",
};

const getWordKey = (word: VocabularyWord): string =>
  word.id || `${word.userId}-${word.word}`;

const sortBySearchRelevance = (
  inputWords: VocabularyWord[],
  searchLower: string,
): VocabularyWord[] => {
  return [...inputWords].sort((a, b) => {
    const aWord = a.word.toLowerCase();
    const bWord = b.word.toLowerCase();

    if (aWord === searchLower && bWord !== searchLower) return -1;
    if (bWord === searchLower && aWord !== searchLower) return 1;

    const aStartsWith = aWord.startsWith(searchLower);
    const bStartsWith = bWord.startsWith(searchLower);
    if (aStartsWith && !bStartsWith) return -1;
    if (bStartsWith && !aStartsWith) return 1;

    return aWord.localeCompare(bWord);
  });
};

const mergeSearchResults = (
  localResults: VocabularyWord[],
  remoteResults: VocabularyWord[],
  searchLower: string,
): VocabularyWord[] => {
  const seenKeys = new Set(localResults.map(getWordKey));
  const merged = [...localResults];

  remoteResults.forEach((word) => {
    const key = getWordKey(word);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(word);
    }
  });

  return sortBySearchRelevance(merged, searchLower);
};

export const VocabularyBook = () => {
  const {
    words,
    loading,
    isLoadingMore,
    isAdding,
    hasMore,
    loadVocabulary,
    loadMore,
    deleteWord,
    addWord,
    updateWord,
    regenerateWordDetails,
    updateReview,
    loadWordsForReview,
    searchWords,
    getTags,
    getWordCount,
  } = useVocabulary();
  const { speak } = useSpeechState();
  const isDesktop = useIsDesktop();
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [filters, setFilters] = useState<VocabularyFilters>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<VocabularyWord[] | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [manualWord, setManualWord] = useState("");
  const [isAddingManualWord, setIsAddingManualWord] = useState(false);

  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [deleteWordId, setDeleteWordId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewWords, setReviewWords] = useState<VocabularyWord[]>([]);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [showReviewSettings, setShowReviewSettings] = useState(false);
  const [totalWordCount, setTotalWordCount] = useState(0);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"words" | "sentences">("words");
  const manualWordFieldId = "manual-word-input";
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchRequestIdRef = useRef(0);

  const refreshTags = useCallback(async () => {
    const tags = await getTags();
    setAvailableTags(tags);
  }, [getTags]);

  // Load vocabulary when component mounts or filters change
  useEffect(() => {
    void loadVocabulary(filters);
  }, [filters, loadVocabulary]);

  // Load available tags once and after tag-affecting operations
  useEffect(() => {
    void refreshTags();
  }, [refreshTags]);

  // Debounced search: local instant results + remote completion
  useEffect(() => {
    const searchText = debouncedSearchQuery.trim();

    if (!searchText) {
      searchRequestIdRef.current += 1;
      setIsSearching(false);
      setSearchResults(null);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    const searchLower = searchText.toLowerCase();
    const localResults = sortBySearchRelevance(
      words.filter((word) => word.word.toLowerCase().includes(searchLower)),
      searchLower,
    );

    setSearchResults(localResults);
    setIsSearching(true);

    const performSearch = async () => {
      try {
        const remoteResults = await searchWords(searchText, {
          mode: "prefix",
          limit: 120,
        });
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults(
          mergeSearchResults(localResults, remoteResults, searchLower),
        );
      } catch (error) {
        console.error("Search failed:", error);
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults(localResults);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    };

    void performSearch();
  }, [debouncedSearchQuery, words, searchWords]);

  const handleUpdateWord = useCallback(
    async (wordId: string, updates: Partial<VocabularyWord>) => {
      const result = await updateWord(wordId, updates);
      if (result.success) {
        void refreshTags();
      }
      return result;
    },
    [updateWord, refreshTags],
  );

  const fetchTotalWordCount = useCallback(async () => {
    const count = await getWordCount();
    setTotalWordCount(count);
    return count;
  }, [getWordCount]);

  // Handle opening review settings modal
  const handleOpenReviewSettings = useCallback(async () => {
    await fetchTotalWordCount();
    setShowReviewSettings(true);
  }, [fetchTotalWordCount]);

  // Handle starting review with settings
  const handleStartReview = useCallback(
    async (settings: ReviewSettings) => {
      setShowReviewSettings(false);
      setIsLoadingReview(true);
      try {
        const selectedWords = await loadWordsForReview(
          settings.wordCount,
          settings.mode,
          settings.selectedTag,
        );
        setReviewWords(selectedWords);
        if (selectedWords.length > 0) {
          setIsReviewMode(true);
        } else {
          setToastMessage({ message: "沒有單字可以複習", type: "info" });
        }
      } catch (error) {
        console.error("Error loading review words:", error);
        setToastMessage({ message: "載入複習清單失敗", type: "error" });
      } finally {
        setIsLoadingReview(false);
      }
    },
    [loadWordsForReview],
  );

  const handleFilterChange = (
    key: keyof VocabularyFilters,
    value: string | undefined,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = manualWord.trim();
    if (!trimmed) return;

    const word = trimmed.split(/\s+/)[0];
    setIsAddingManualWord(true);
    try {
      const response = await addWord(word);
      if (response.success) {
        setToastMessage({
          message: `"${word}" 已加入生詞本！`,
          type: "success",
        });
        setManualWord("");
        await Promise.all([loadVocabulary(filters), refreshTags()]);
      } else {
        const message =
          response.message === "Word already in vocabulary"
            ? `"${word}" 已經存在生詞本`
            : response.message || "加入失敗";
        setToastMessage({
          message,
          type:
            response.message === "Word already in vocabulary"
              ? "info"
              : "error",
        });
      }
    } catch (error) {
      console.error("Error adding manual vocabulary word:", error);
      setToastMessage({
        message: "加入生詞本時發生錯誤",
        type: "error",
      });
    } finally {
      setIsAddingManualWord(false);
    }
  };

  const handleDelete = (wordId: string) => {
    setDeleteWordId(wordId);
  };

  const confirmDelete = async () => {
    if (!deleteWordId) return;

    setIsDeleting(true);
    try {
      await deleteWord(deleteWordId);
      if (selectedWord?.id === deleteWordId) {
        setSelectedWord(null);
      }
      await refreshTags();
      setToastMessage({
        message: "單字已刪除",
        type: "success",
      });
    } catch (error) {
      console.error("Error deleting word:", error);
      setToastMessage({
        message: "刪除失敗，請稍後再試",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
      setDeleteWordId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteWordId(null);
  };

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    await loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  // Infinite scroll using IntersectionObserver (more efficient than scroll events)
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore && !loading) {
          void handleLoadMore();
        }
      },
      {
        rootMargin: "100px",
        threshold: 0,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loading, handleLoadMore]);

  // Memoize word groups to prevent recalculation on every render
  const wordGroups = useMemo(() => groupWordsByDate(words), [words]);

  // Desktop master-detail: keep a word selected so the detail pane isn't empty.
  useEffect(() => {
    if (!isDesktop) return;
    if (selectedWord) return;
    if (searchResults === null && words.length > 0) {
      setSelectedWord(words[0]);
    }
  }, [isDesktop, selectedWord, searchResults, words]);

  if (isReviewMode && reviewWords.length > 0) {
    return (
      <FlashcardMode
        words={reviewWords}
        onClose={() => {
          setIsReviewMode(false);
          setReviewWords([]);
        }}
        onUpdateReview={updateReview}
      />
    );
  }

  // Words currently shown in the list pane (search results or date groups).
  const showingSearch = searchResults !== null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem-2rem)] flex-col md:h-[calc(100dvh-3.5rem-3rem)]">
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      <ReviewSettingsModal
        isOpen={showReviewSettings}
        onClose={() => setShowReviewSettings(false)}
        onStart={handleStartReview}
        totalWords={totalWordCount}
        availableTags={availableTags}
        isLoading={isLoadingReview}
      />

      {/* Segmented control */}
      <div className="mb-4 flex shrink-0 gap-1 rounded-xl surface-card p-1">
        <button
          type="button"
          className={`h-10 flex-1 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
            activeTab === "words"
              ? "bg-primary text-primary-content shadow-soft"
              : "text-muted-foreground hover:bg-accent-tint hover:text-accent"
          }`}
          onClick={() => setActiveTab("words")}
        >
          📖 單字
        </button>
        <button
          type="button"
          className={`h-10 flex-1 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
            activeTab === "sentences"
              ? "bg-primary text-primary-content shadow-soft"
              : "text-muted-foreground hover:bg-accent-tint hover:text-accent"
          }`}
          onClick={() => setActiveTab("sentences")}
        >
          🌐 句子翻譯
        </button>
      </div>

      {/* WORDS TAB */}
      {activeTab === "words" && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-6">
          {/* List pane */}
          <aside className="flex min-h-0 flex-1 flex-col lg:w-72 lg:flex-none lg:shrink-0 xl:w-80 2xl:w-96">
            {/* Compact toolbar */}
            <div className="shrink-0 space-y-2">
              <form className="flex gap-2" onSubmit={handleManualSubmit}>
                <input
                  id={manualWordFieldId}
                  type="text"
                  placeholder="手動新增英文單字"
                  className="input input-bordered input-sm min-w-0 flex-1"
                  value={manualWord}
                  onChange={(e) => setManualWord(e.target.value)}
                  disabled={isAddingManualWord}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm active:scale-[0.98]"
                  disabled={isAddingManualWord || isAdding || manualWord.trim().length === 0}
                >
                  {isAddingManualWord || isAdding ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "新增"
                  )}
                </button>
              </form>

              <div className="relative">
                <input
                  type="text"
                  placeholder="搜尋單字..."
                  className="input input-bordered input-sm w-full pr-16"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery.trim() && (
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1 text-xs text-muted-foreground">
                    {isSearching && <span className="loading loading-spinner loading-xs" />}
                    <span>{isSearching ? "更新中" : `${searchResults?.length ?? 0}`}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="select select-bordered select-sm min-w-0 flex-1"
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                >
                  <option value="createdAt">加入時間</option>
                  <option value="word">字母順序</option>
                </select>
                <select
                  className="select select-bordered select-sm min-w-0 flex-1"
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange("sortOrder", e.target.value)}
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
                {words.length > 0 && !loading && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm shrink-0 active:scale-[0.98]"
                    onClick={handleOpenReviewSettings}
                    disabled={isLoadingReview}
                    title="開始複習"
                  >
                    {isLoadingReview ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      "複習"
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable list */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
              {/* Initial loading */}
              {loading && words.length === 0 && (
                <div className="space-y-2 py-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-base-300/60 animate-pulse" />
                  ))}
                </div>
              )}

              {/* Empty: no words at all */}
              {!loading && !showingSearch && words.length === 0 && (
                <div className="rounded-xl surface-card p-6 text-center">
                  <div className="mb-2 text-4xl">📖</div>
                  <p className="text-sm text-muted-foreground">
                    還沒有收藏的單字。在閱讀 PDF 時選取單字加入生詞本，或用上方輸入框手動新增。
                  </p>
                </div>
              )}

              {/* Search results as rows */}
              {!loading && showingSearch && (
                <div className="space-y-1">
                  {searchResults!.length === 0 ? (
                    <div className="rounded-xl surface-card p-6 text-center">
                      <div className="mb-2 text-3xl">🔍</div>
                      <p className="text-sm text-muted-foreground">
                        找不到符合「{debouncedSearchQuery || searchQuery.trim()}」的單字
                      </p>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {searchResults!.map((word) => (
                        <VocabularyRow
                          key={word.id}
                          word={word}
                          isActive={selectedWord?.id === word.id}
                          onSelect={() => setSelectedWord(word)}
                          onPlay={(e) => {
                            e.stopPropagation();
                            speak(word.word);
                          }}
                          onDelete={(e) => {
                            e.stopPropagation();
                            handleDelete(word.id!);
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              )}

              {/* Date groups as rows */}
              {!loading && !showingSearch && words.length > 0 && (
                <div className="space-y-4">
                  {Object.entries(wordGroups).map(([date, groupWords]) => (
                    <div key={date}>
                      <h2 className="sticky top-0 z-10 mb-1 flex items-center gap-2 rounded-lg toolbar px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-accent/60" />
                        {date}
                        <span className="rounded-full bg-base-200 px-1.5 py-0.5 text-[10px] font-normal">
                          {groupWords.length}
                        </span>
                      </h2>
                      <div className="space-y-1">
                        <AnimatePresence mode="popLayout">
                          {groupWords.map((word) => (
                            <VocabularyRow
                              key={word.id}
                              word={word}
                              isActive={selectedWord?.id === word.id}
                              onSelect={() => setSelectedWord(word)}
                              onPlay={(e) => {
                                e.stopPropagation();
                                speak(word.word);
                              }}
                              onDelete={(e) => {
                                e.stopPropagation();
                                handleDelete(word.id!);
                              }}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                  <div ref={loadMoreRef} className="py-4 text-center">
                    {hasMore && isLoadingMore && (
                      <span className="loading loading-spinner loading-md text-primary" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Detail pane (desktop only) */}
          <section className="hidden min-h-0 flex-1 overflow-y-auto rounded-2xl surface-card p-6 lg:block">
            {selectedWord ? (
              <WordDetailPanel
                key={selectedWord.id}
                word={selectedWord}
                onUpdateWord={handleUpdateWord}
                onRegenerateWordDetails={regenerateWordDetails}
                availableTags={availableTags}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <div className="mb-3 text-5xl">📖</div>
                <p className="text-sm">選擇一個單字以查看詳情</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SENTENCES TAB */}
      {activeTab === "sentences" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SentenceTranslationBook embedded />
        </div>
      )}

      {/* Mobile / tablet: detail as a modal sheet */}
      {!isDesktop && selectedWord && (
        <WordDetail
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          onUpdateWord={handleUpdateWord}
          onRegenerateWordDetails={regenerateWordDetails}
          availableTags={availableTags}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={deleteWordId !== null}
        title="刪除單字"
        message="確定要刪除這個單字嗎？此操作無法復原。"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="刪除"
        cancelText="取消"
        confirmVariant="error"
        isLoading={isDeleting}
      />
    </div>
  );
};
