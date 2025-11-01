import { useEffect, useState } from "react";
import { useVocabulary } from "../../hooks/useVocabulary";
import { useSpeechState } from "../../hooks/useSpeechState";
import type { VocabularyWord, VocabularyFilters } from "../../types/vocabulary";
import { WordDetail } from "../Vocabulary/WordDetail";
import { SimpleTTSControls } from "../common/SimpleTTSControls";
export const VocabularyBook = () => {
  const { words, loading, loadVocabulary, deleteWord } = useVocabulary();
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

  // Load vocabulary when component mounts or filters change
  useEffect(() => {
    loadVocabulary(filters);
  }, [filters, loadVocabulary]);

  // Immediate search when searchQuery changes
  useEffect(() => {
    setFilters((prev) => ({ ...prev, searchQuery }));
  }, [searchQuery]);

  const handleRefresh = () => {
    loadVocabulary(filters);
  };

  const handleFilterChange = (
    key: keyof VocabularyFilters,
    value: string | undefined,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleDelete = async (wordId: string) => {
    if (confirm("確定要刪除這個單字嗎？")) {
      await deleteWord(wordId);
      if (selectedWord?.id === wordId) {
        setSelectedWord(null);
      }
    }
  };

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

  const wordGroups = groupWordsByDate(words);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
          📚 我的生詞本
        </h1>
        <div className="flex items-center justify-center gap-3">
          <p className="text-base-content/70">收藏的單字共 {words.length} 個</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="btn btn-ghost btn-sm btn-circle"
            title="重新整理"
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </button>
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

      {/* Filters and Search */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="搜尋單字..."
              className="input input-bordered flex-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Difficulty Filter */}
            <select
              className="select select-bordered select-sm"
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
              className="select select-bordered select-sm"
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
            >
              <option value="createdAt">加入時間</option>
              <option value="word">字母順序</option>
              <option value="reviewCount">複習次數</option>
            </select>

            <select
              className="select select-bordered select-sm"
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
        <div className="space-y-6">
          {Object.entries(wordGroups).map(([date, groupWords]) => (
            <div key={date}>
              <h2 className="text-xl font-semibold mb-3 px-2">{date}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupWords.map((word) => (
                  <div
                    key={word.id}
                    className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                    onClick={() => setSelectedWord(word)}
                  >
                    <div className="card-body">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="card-title text-2xl mb-1">
                            {word.word}
                          </h3>
                          {word.phonetic && (
                            <p className="text-sm text-base-content/60 mb-2">
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
                          className="btn btn-ghost btn-sm btn-circle"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>

                      {word.definitions.length > 0 && (
                        <p className="text-sm line-clamp-2">
                          {word.definitions[0].definition}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 mt-2">
                        {word.difficulty && (
                          <span
                            className={`badge badge-sm ${
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
                        {word.tags.map((tag) => (
                          <span
                            key={tag}
                            className="badge badge-sm badge-outline"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {word.sourceContext && (
                        <div className="mt-3 pt-3 border-t border-base-300">
                          <p className="text-xs text-base-content/50 line-clamp-2">
                            {word.sourceContext}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
    </div>
  );
};
