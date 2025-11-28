import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import { useVocabulary } from "../../hooks/useVocabulary";
import { useSpeechState } from "../../hooks/useSpeechState";
import { useDebounce } from "../../hooks/useDebounce";
import type { VocabularyWord, VocabularyFilters } from "../../types/vocabulary";
import { WordDetail } from "../Vocabulary/WordDetail";
import { SimpleTTSControls } from "../common/SimpleTTSControls";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";

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
export const VocabularyBook = () => {
  const {
    words,
    loading,
    hasMore,
    loadVocabulary,
    loadMore,
    deleteWord,
    addWord,
  } = useVocabulary();
  const {
    speechSupported,
    speechRate,
    setSpeechRate,
    isSpeaking,
    ttsMode,
    setTtsMode,
    isLoadingAudio,
    stopSpeaking,
  } = useSpeechState();
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [filters, setFilters] = useState<VocabularyFilters>({
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [manualWord, setManualWord] = useState("");
  const [isAddingManualWord, setIsAddingManualWord] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [deleteWordId, setDeleteWordId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const manualWordFieldId = "manual-word-input";

  // Load vocabulary when component mounts or filters change
  useEffect(() => {
    loadVocabulary(filters);
  }, [filters, loadVocabulary]);

  // Debounced search - only update filters after user stops typing
  useEffect(() => {
    setFilters((prev) => ({ ...prev, searchQuery: debouncedSearchQuery }));
  }, [debouncedSearchQuery]);

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
        await loadVocabulary(filters);
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

  const handleDelete = async (wordId: string) => {
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

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Memoize word groups to prevent recalculation on every render
  const wordGroups = useMemo(() => groupWordsByDate(words), [words]);

  return (
    <div className="container mx-auto max-w-7xl">
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* TTS Controls */}
      {speechSupported && (
        <div className="mb-4">
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

      {/* Manual Add */}
      <div className="bg-base-100 rounded-lg shadow p-4 mb-4">
        <form
          className="flex flex-col sm:flex-row gap-3 sm:items-end"
          onSubmit={handleManualSubmit}
        >
          <div className="flex-1">
            <label
              htmlFor={manualWordFieldId}
              className="block text-sm font-medium text-base-content mb-2"
            >
              手動新增英文單字
            </label>
            <input
              id={manualWordFieldId}
              type="text"
              placeholder="例如：vocabulary"
              className="input input-bordered w-full"
              value={manualWord}
              onChange={(e) => setManualWord(e.target.value)}
              disabled={isAddingManualWord}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto sm:min-w-[10rem]"
            disabled={isAddingManualWord || manualWord.trim().length === 0}
          >
            {isAddingManualWord ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                處理中…
              </>
            ) : (
              "加入生詞本"
            )}
          </button>
        </form>
      </div>

      {/* Compact Filters and Search */}
      <div className="bg-base-100 rounded-lg shadow p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="搜尋單字..."
            className="input input-bordered input-sm w-full sm:flex-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="grid grid-cols-3 sm:flex gap-2">
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
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Empty State */}
      {!loading && words.length === 0 && (
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

      {/* Word Groups */}
      {!loading && Object.keys(wordGroups).length > 0 && (
        <div className="space-y-5">
          {Object.entries(wordGroups).map(([date, groupWords]) => (
            <div key={date}>
              <h2 className="text-lg font-semibold mb-3 text-base-content/70">
                {date}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupWords.map((word) => (
                  <div
                    key={word.id}
                    className="card bg-base-100 shadow hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedWord(word)}
                  >
                    <div className="card-body p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold mb-1 truncate">
                            {word.word}
                          </h3>
                          {word.phonetic && (
                            <p className="text-xs text-base-content/60 mb-2">
                              {word.phonetic}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(word.id!);
                          }}
                          className="btn btn-ghost btn-xs btn-circle"
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
                        </button>
                      </div>

                      {word.definitions.length > 0 && (
                        <p className="text-sm line-clamp-2 text-base-content/80">
                          {word.definitions[0].definition}
                        </p>
                      )}

                      {(word.difficulty || word.tags.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {word.difficulty && (
                            <span
                              className={`badge badge-xs ${
                                word.difficulty === "easy"
                                  ? "badge-success"
                                  : word.difficulty === "medium"
                                  ? "badge-warning"
                                  : "badge-error"
                              }`}
                            >
                              {word.difficulty === "easy"
                                ? "簡單"
                                : word.difficulty === "medium"
                                ? "中等"
                                : "困難"}
                            </span>
                          )}
                          {word.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="badge badge-xs badge-outline"
                            >
                              {tag}
                            </span>
                          ))}
                          {word.tags.length > 2 && (
                            <span className="badge badge-xs badge-ghost">
                              +{word.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center py-6">
              <button
                type="button"
                className="btn btn-outline btn-primary"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    載入中…
                  </>
                ) : (
                  "載入更多"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Word Detail Modal */}
      {selectedWord && (
        <WordDetail
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          onUpdate={() => loadVocabulary(filters)}
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
