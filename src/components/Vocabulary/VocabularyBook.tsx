import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useVocabulary } from "../../hooks/useVocabulary";
import { useSpeechState } from "../../hooks/useSpeechState";
import { useDebounce } from "../../hooks/useDebounce";
import type {
  VocabularyWord,
  VocabularyFilters,
  ReviewSettings,
} from "../../types/vocabulary";
import { WordDetail } from "../Vocabulary/WordDetail";
import { VocabularyCard } from "../Vocabulary/VocabularyCard";
import { SimpleTTSControls } from "../common/SimpleTTSControls";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";

import { FlashcardMode } from "./FlashcardMode";
import { ReviewSettingsModal } from "./ReviewSettingsModal";

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
  const {
    speechSupported,
    speechRate,
    isSpeaking,
    ttsMode,
    setTtsMode,
    isLoadingAudio,
    stopSpeaking,
    speak,
  } = useSpeechState();
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

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchQuery.trim() ||
        filters.difficulty ||
        filters.sortBy !== DEFAULT_FILTERS.sortBy ||
        filters.sortOrder !== DEFAULT_FILTERS.sortOrder,
    );
  }, [searchQuery, filters]);

  const handleClearSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearchQuery("");
    setSearchResults(null);
    setIsSearching(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    handleClearSearch();
    setFilters({ ...DEFAULT_FILTERS });
  }, [handleClearSearch]);

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

  return (
    <div className="container mx-auto max-w-7xl">
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Review Settings Modal */}
      <ReviewSettingsModal
        isOpen={showReviewSettings}
        onClose={() => setShowReviewSettings(false)}
        onStart={handleStartReview}
        totalWords={totalWordCount}
        availableTags={availableTags}
        isLoading={isLoadingReview}
      />

      {/* Toolbar: TTS + Manual Add + Start Review */}
      <div className="bg-base-100 rounded-lg shadow p-3 mb-4 flex flex-wrap gap-3 items-center">
        {speechSupported && (
          <SimpleTTSControls
            ttsMode={ttsMode}
            speechRate={speechRate}
            isSpeaking={isSpeaking}
            isLoadingAudio={isLoadingAudio}
            onTtsModeChange={setTtsMode}
            onStop={stopSpeaking}
          />
        )}
        <form
          className="flex flex-1 min-w-0 gap-2 items-center"
          onSubmit={handleManualSubmit}
        >
          <input
            id={manualWordFieldId}
            type="text"
            placeholder="手動新增英文單字"
            className="input input-bordered input-sm flex-1 min-w-[8rem]"
            value={manualWord}
            onChange={(e) => setManualWord(e.target.value)}
            disabled={isAddingManualWord}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={
              isAddingManualWord || isAdding || manualWord.trim().length === 0
            }
          >
            {isAddingManualWord || isAdding ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "加入生詞本"
            )}
          </button>
        </form>
        {words.length > 0 && !loading && (
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1"
            onClick={handleOpenReviewSettings}
            disabled={isLoadingReview}
          >
            {isLoadingReview ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
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
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
            )}
            開始複習
          </button>
        )}
      </div>

      {/* Compact Filters and Search */}
      <div className="bg-base-100 rounded-lg shadow p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:flex-1">
            <input
              type="text"
              placeholder="搜尋單字..."
              className="input input-bordered input-sm w-full pr-24"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.trim() && (
              <div className="absolute inset-y-0 right-3 flex items-center gap-2 text-xs text-base-content/60">
                {isSearching && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                <span>{isSearching ? "更新中" : `${searchResults?.length ?? 0} 筆`}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Difficulty Filter */}
            <select
              className="select select-bordered select-sm w-full sm:w-auto"
              value={filters.difficulty || ""}
              onChange={(e) =>
                handleFilterChange("difficulty", e.target.value || undefined)
              }
            >
              <option value="">所有難度</option>
              <option value="easy">簡單</option>
              <option value="medium">中等</option>
              <option value="hard">困難</option>
            </select>

            {/* Sort Options */}
            <select
              className="select select-bordered select-sm w-full sm:w-auto"
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
            >
              <option value="createdAt">加入時間</option>
              <option value="word">字母順序</option>
            </select>

            <select
              className="select select-bordered select-sm w-full sm:w-auto"
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange("sortOrder", e.target.value)}
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>

            <button
              type="button"
              className="btn btn-ghost btn-sm sm:w-auto min-h-11"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
            >
              清除篩選
            </button>
          </div>
        </div>
      </div>

      {/* Initial Loading State */}
      {loading && words.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 py-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="card bg-base-100 border border-base-200">
              <div className="card-body p-4">
                <div className="h-6 w-2/3 rounded bg-base-300 animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-base-300 animate-pulse" />
                <div className="h-12 w-full rounded bg-base-300 animate-pulse mt-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State - No words at all */}
      {!loading && searchResults === null && words.length === 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center py-12">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-bold mb-2">還沒有收藏的單字</h2>
            <p className="text-base-content/70">
              在閱讀 PDF 時選取單字，點擊「加入生詞本」按鈕開始收藏吧！
            </p>
          </div>
        </div>
      )}

      {/* Search Results */}
      {!loading && searchResults !== null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-base-content/60 flex items-center gap-2">
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              搜尋結果
              <span className="text-xs font-normal bg-base-200 px-2 py-0.5 rounded-full">
                {searchResults.length}
              </span>
              {isSearching && (
                <span className="loading loading-spinner loading-xs text-primary" />
              )}
            </h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearSearch}
            >
              清除搜尋
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body text-center py-8">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-base-content/60">
                  找不到符合「{debouncedSearchQuery || searchQuery.trim()}」的單字
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence mode="popLayout">
                {searchResults.map((word) => (
                  <VocabularyCard
                    key={word.id}
                    word={word}
                    onClick={() => setSelectedWord(word)}
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
          )}
        </div>
      )}

      {/* Word Groups - Only show when not searching */}
      {!loading &&
        searchResults === null &&
        Object.keys(wordGroups).length > 0 && (
          <div className="space-y-8">
            {Object.entries(wordGroups).map(([date, groupWords]) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <h2 className="text-lg font-bold mb-4 text-base-content/60 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                  {date}
                  <span className="text-xs font-normal bg-base-200 px-2 py-0.5 rounded-full">
                    {groupWords.length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  <AnimatePresence mode="popLayout">
                    {groupWords.map((word) => (
                      <VocabularyCard
                        key={word.id}
                        word={word}
                        onClick={() => setSelectedWord(word)}
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
              </motion.div>
            ))}

            {/* Load More Indicator */}
            <div ref={loadMoreRef} className="text-center py-6">
              {hasMore && isLoadingMore && (
                <span className="loading loading-spinner loading-md text-primary" />
              )}
            </div>
          </div>
        )}

      {/* Word Detail Modal */}
      {selectedWord && (
        <WordDetail
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          onUpdateWord={handleUpdateWord}
          onRegenerateWordDetails={regenerateWordDetails}
          availableTags={availableTags}
        />
      )}

      {/* Delete Confirmation Modal */}
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
