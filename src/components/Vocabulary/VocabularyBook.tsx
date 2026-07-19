import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { useVocabulary } from "../../hooks/useVocabulary";
import { useSentenceTranslation } from "../../hooks/useSentenceTranslation";
import { useSpeechState } from "../../hooks/useSpeechState";
import { useDebounce } from "../../hooks/useDebounce";
import { smartLookup } from "../../services/aiService";
import type {
  VocabularyWord,
  VocabularyFilters,
  ReviewSettings,
} from "../../types/vocabulary";
import { WordDetail } from "./WordDetail";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";

import { FlashcardMode } from "./FlashcardMode";
import { ReviewSettingsModal } from "./ReviewSettingsModal";
import { VocabularyRow } from "./VocabularyRow";
import { WordDetailPanel } from "./WordDetailPanel";
import { SentenceRow } from "../SentenceTranslation/SentenceRow";
import { SentenceDetail } from "../SentenceTranslation/SentenceDetail";
import { SentenceDetailPanel } from "../SentenceTranslation/SentenceDetailPanel";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import {
  toolbarFieldClass,
  toolbarPrimaryButtonClass,
} from "../common/toolbarStyles";
import {
  computeMergedFeed,
  feedItemKey,
  filterFeedItemsByType,
  groupFeedItemsByDate,
  type FeedItem,
  type FeedTypeFilter,
} from "../../utils/unifiedFeed";

// The feed is always newest-first; sorting UI was removed with the tab merge.
const FEED_FILTERS: VocabularyFilters = {
  sortBy: "createdAt",
  sortOrder: "desc",
};

// Han + kana + hangul — the smart query only handles English input.
const CJK_PATTERN = /\p{Script=Han}|[぀-ヿ가-힯]/u;

// Strip punctuation around the input ("run." → "run") while keeping inner
// characters like hyphens and apostrophes intact.
const EDGE_PUNCTUATION_PATTERN = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

const TYPE_FILTERS: Array<{ value: FeedTypeFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "words", label: "單字" },
  { value: "sentences", label: "句子" },
];

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
    hasMore,
    loadVocabulary,
    loadMore,
    deleteWord,
    addWord,
    lookupOrAddWord,
    findExistingWord,
    addWordFromDetails,
    updateWord,
    regenerateWordDetails,
    updateReview,
    loadWordsForReview,
    searchWords,
    getTags,
    getWordCount,
  } = useVocabulary();
  const {
    sentences,
    isLoading: sentencesLoading,
    hasMore: sentencesHasMore,
    loadSentences,
    loadMore: loadMoreSentences,
    findExistingSentence,
    addTranslatedSentence,
    deleteSentence,
  } = useSentenceTranslation();
  const { speak, isSpeaking, stopSpeaking } = useSpeechState();
  const isDesktop = useIsDesktop();

  const [query, setQuery] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>("all");
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchItems, setSearchItems] = useState<FeedItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "word" | "sentence";
    id: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewWords, setReviewWords] = useState<VocabularyWord[]>([]);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [showReviewSettings, setShowReviewSettings] = useState(false);
  const [totalWordCount, setTotalWordCount] = useState(0);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const smartQueryFieldId = "smart-query-input";
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchRequestIdRef = useRef(0);
  const queryAbortRef = useRef<AbortController | null>(null);

  const refreshTags = useCallback(async () => {
    const tags = await getTags();
    setAvailableTags(tags);
  }, [getTags]);

  // Load both streams when the component mounts (or the user changes)
  useEffect(() => {
    void loadVocabulary(FEED_FILTERS);
  }, [loadVocabulary]);

  useEffect(() => {
    void loadSentences();
  }, [loadSentences]);

  useEffect(() => {
    void refreshTags();
  }, [refreshTags]);

  // Abort an in-flight smart query when leaving the page
  useEffect(() => {
    return () => {
      queryAbortRef.current?.abort();
    };
  }, []);

  const mergedFeed = useMemo(
    () =>
      computeMergedFeed({
        filter: typeFilter,
        words,
        wordsHasMore: hasMore,
        sentences,
        sentencesHasMore,
      }),
    [typeFilter, words, hasMore, sentences, sentencesHasMore],
  );

  const displayItems = useMemo(
    () =>
      searchItems
        ? filterFeedItemsByType(searchItems, typeFilter)
        : mergedFeed.items,
    [searchItems, typeFilter, mergedFeed.items],
  );

  const feedGroups = useMemo(
    () => groupFeedItemsByDate(displayItems),
    [displayItems],
  );

  // Unified search: words get local + remote prefix results, sentences a
  // local filter over the loaded list.
  useEffect(() => {
    const searchText = debouncedSearchQuery.trim();

    if (!searchText) {
      searchRequestIdRef.current += 1;
      setIsSearching(false);
      setSearchItems(null);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    const searchLower = searchText.toLowerCase();

    const sentenceMatches: FeedItem[] = sentences
      .filter(
        (sentence) =>
          sentence.english.toLowerCase().includes(searchLower) ||
          sentence.chinese.includes(searchText),
      )
      .map((sentence) => ({ kind: "sentence", sentence }));

    const localWordResults = sortBySearchRelevance(
      words.filter((word) => word.word.toLowerCase().includes(searchLower)),
      searchLower,
    );

    const toItems = (wordResults: VocabularyWord[]): FeedItem[] => [
      ...wordResults.map((word) => ({ kind: "word" as const, word })),
      ...sentenceMatches,
    ];

    setSearchItems(toItems(localWordResults));
    setIsSearching(true);

    const performSearch = async () => {
      try {
        const remoteResults = await searchWords(searchText, {
          mode: "prefix",
          limit: 120,
        });
        if (requestId !== searchRequestIdRef.current) return;
        setSearchItems(
          toItems(mergeSearchResults(localWordResults, remoteResults, searchLower)),
        );
      } catch (error) {
        console.error("Search failed:", error);
        if (requestId !== searchRequestIdRef.current) return;
        setSearchItems(toItems(localWordResults));
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    };

    void performSearch();
  }, [debouncedSearchQuery, words, sentences, searchWords]);

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

  // One input for everything: a single word looks up the dictionary directly;
  // multi-word input is classified by AI as a phrase (saved as a word) or a
  // sentence (translated and saved), with cached results short-circuiting.
  const handleSmartSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isQuerying) return;

    if (CJK_PATTERN.test(trimmed)) {
      setToastMessage({ message: "請輸入英文單字或句子喔！", type: "info" });
      return;
    }

    const stripped = trimmed.replace(EDGE_PUNCTUATION_PATTERN, "");
    if (!stripped) {
      setToastMessage({ message: "請輸入英文單字或句子喔！", type: "info" });
      return;
    }

    queryAbortRef.current?.abort();
    const controller = new AbortController();
    queryAbortRef.current = controller;
    const { signal } = controller;

    setIsQuerying(true);
    try {
      if (!/\s/.test(stripped)) {
        const res = await lookupOrAddWord(stripped, undefined, signal);
        if (signal.aborted) return;
        if (res.success && res.existingWord) {
          setSelected({ kind: "word", word: res.existingWord });
          if (res.isNew) {
            setToastMessage({
              message: `「${res.existingWord.word}」已加入生詞本！`,
              type: "success",
            });
            setQuery("");
            await loadVocabulary(FEED_FILTERS);
            void refreshTags();
          } else {
            setToastMessage({
              message: `「${res.existingWord.word}」已經在生詞本裡了`,
              type: "info",
            });
          }
        } else {
          setToastMessage({
            message: res.message || "查詢失敗，請稍後再試",
            type: "error",
          });
        }
        return;
      }

      const phrase = stripped.replace(/\s+/g, " ");
      const existingWord = await findExistingWord(phrase);
      if (signal.aborted) return;
      if (existingWord) {
        setSelected({ kind: "word", word: existingWord });
        setToastMessage({
          message: `「${existingWord.word}」已經在生詞本裡了`,
          type: "info",
        });
        return;
      }

      const existingSentence = await findExistingSentence(trimmed);
      if (signal.aborted) return;
      if (existingSentence) {
        setSelected({ kind: "sentence", sentence: existingSentence });
        setToastMessage({ message: "句子已存在翻譯本", type: "info" });
        return;
      }

      const result = await smartLookup(trimmed, signal);
      if (signal.aborted) return;
      if (!result) {
        setToastMessage({ message: "查詢失敗，請稍後再試", type: "error" });
        return;
      }

      if (result.kind === "word") {
        const res = await addWordFromDetails(phrase, result.details);
        if (signal.aborted) return;
        if (res.success && res.word) {
          setSelected({ kind: "word", word: res.word });
          if (res.existing) {
            setToastMessage({
              message: `「${res.word.word}」已經在生詞本裡了`,
              type: "info",
            });
          } else {
            setToastMessage({
              message: `「${res.word.word}」已加入生詞本！`,
              type: "success",
            });
            setQuery("");
            await loadVocabulary(FEED_FILTERS);
            void refreshTags();
          }
        } else {
          setToastMessage({
            message: res.message || "查詢失敗，請稍後再試",
            type: "error",
          });
        }
        return;
      }

      const saved = await addTranslatedSentence(
        trimmed,
        result.chinese,
        result.keyWords,
      );
      if (signal.aborted) return;
      if (saved) {
        setSelected({ kind: "sentence", sentence: saved });
        setToastMessage({ message: "句子已加入翻譯本", type: "success" });
        setQuery("");
        await loadSentences();
      } else {
        setToastMessage({ message: "儲存句子失敗，請稍後再試", type: "error" });
      }
    } catch (error) {
      console.error("Smart lookup failed:", error);
      if (!signal.aborted) {
        setToastMessage({ message: "查詢失敗，請稍後再試", type: "error" });
      }
    } finally {
      setIsQuerying(false);
    }
  };

  // Add a key word from a sentence's chips to the vocabulary book
  const handleAddKeyWord = useCallback(
    async (word: string) => {
      const response = await addWord(word);
      if (response.success) {
        setToastMessage({
          message: `「${word}」已加入生詞本！`,
          type: "success",
        });
        void loadVocabulary(FEED_FILTERS);
        void refreshTags();
        return { success: true };
      }
      if (response.message === "Word already in vocabulary") {
        setToastMessage({
          message: `「${word}」已經在生詞本裡了`,
          type: "info",
        });
        return { success: true, existed: true };
      }
      setToastMessage({
        message: response.message || "加入失敗",
        type: "error",
      });
      return { success: false, message: response.message };
    },
    [addWord, loadVocabulary, refreshTags],
  );

  const handleSpeakSentence = useCallback(
    (text: string) => {
      if (isSpeaking) {
        stopSpeaking();
      } else {
        speak(text);
      }
    },
    [isSpeaking, stopSpeaking, speak],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      if (pendingDelete.kind === "word") {
        await deleteWord(pendingDelete.id);
        await refreshTags();
      } else {
        await deleteSentence(pendingDelete.id);
      }
      const selectedId =
        selected?.kind === "word"
          ? selected.word.id
          : selected?.kind === "sentence"
            ? selected.sentence.id
            : undefined;
      if (selected && selected.kind === pendingDelete.kind && selectedId === pendingDelete.id) {
        setSelected(null);
      }
      setToastMessage({
        message: pendingDelete.kind === "word" ? "單字已刪除" : "句子已刪除",
        type: "success",
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      setToastMessage({ message: "刪除失敗，請稍後再試", type: "error" });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || sentencesLoading || !mergedFeed.hasMore) return;
    await Promise.all(
      mergedFeed.advance.map((stream) =>
        stream === "words" ? loadMore() : loadMoreSentences(),
      ),
    );
  }, [isLoadingMore, sentencesLoading, mergedFeed, loadMore, loadMoreSentences]);

  // Infinite scroll using IntersectionObserver (more efficient than scroll events)
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          mergedFeed.hasMore &&
          !isLoadingMore &&
          !sentencesLoading &&
          !loading
        ) {
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
  }, [mergedFeed.hasMore, isLoadingMore, sentencesLoading, loading, handleLoadMore]);

  // Desktop master-detail: keep an item selected so the detail pane isn't empty.
  // Wait for both streams' initial load so the true newest item wins.
  useEffect(() => {
    if (!isDesktop) return;
    if (selected) return;
    if (loading || sentencesLoading) return;
    if (searchItems === null && mergedFeed.items.length > 0) {
      setSelected(mergedFeed.items[0]);
    }
  }, [isDesktop, selected, loading, sentencesLoading, searchItems, mergedFeed.items]);

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

  const showingSearch = searchItems !== null;
  const isInitialLoading =
    !showingSearch &&
    ((loading && words.length === 0) ||
      (sentencesLoading && sentences.length === 0));

  const emptyCopy =
    typeFilter === "sentences"
      ? "還沒有翻譯過的句子。輸入英文句子，或在閱讀器中選取句子並點擊翻譯。"
      : typeFilter === "words"
        ? "還沒有收藏的單字。輸入英文單字，或在閱讀 PDF 時選取單字加入生詞本。"
        : "還沒有收藏的內容。輸入英文單字或句子，或在閱讀 PDF 時選取文字加入。";

  const renderFeedItem = (item: FeedItem) => {
    if (item.kind === "word") {
      const { word } = item;
      return (
        <VocabularyRow
          key={feedItemKey(item)}
          word={word}
          isActive={selected?.kind === "word" && selected.word.id === word.id}
          onSelect={() => setSelected({ kind: "word", word })}
          onPlay={(e) => {
            e.stopPropagation();
            speak(word.word);
          }}
          onDelete={(e) => {
            e.stopPropagation();
            setPendingDelete({ kind: "word", id: word.id! });
          }}
        />
      );
    }

    const { sentence } = item;
    return (
      <SentenceRow
        key={feedItemKey(item)}
        sentence={sentence}
        isActive={
          selected?.kind === "sentence" && selected.sentence.id === sentence.id
        }
        onSelect={() => setSelected({ kind: "sentence", sentence })}
        onPlay={(e) => {
          e.stopPropagation();
          handleSpeakSentence(sentence.english);
        }}
        onDelete={(e) => {
          e.stopPropagation();
          setPendingDelete({ kind: "sentence", id: sentence.id! });
        }}
      />
    );
  };

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

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-6">
        {/* List pane */}
        <aside className="flex min-h-0 flex-1 flex-col lg:w-72 lg:flex-none lg:shrink-0 xl:w-80 2xl:w-96">
          {/* Compact toolbar */}
          <div className="shrink-0 space-y-2">
            <form className="flex gap-2" onSubmit={handleSmartSubmit}>
              <input
                id={smartQueryFieldId}
                type="text"
                placeholder="輸入英文單字或句子"
                className={`${toolbarFieldClass} flex-1`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isQuerying}
                autoComplete="off"
              />
              <button
                type="submit"
                className={toolbarPrimaryButtonClass}
                disabled={isQuerying || query.trim().length === 0}
              >
                {isQuerying ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "查詢"
                )}
              </button>
            </form>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="搜尋單字或句子..."
                className={`${toolbarFieldClass} w-full pl-9 pr-16`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery.trim() && (
                <div className="absolute inset-y-0 right-2 flex items-center gap-1 text-xs text-muted-foreground">
                  {isSearching && <span className="loading loading-spinner loading-xs" />}
                  <span>{isSearching ? "更新中" : `${displayItems.length}`}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-11 flex-1 gap-1 rounded-lg border border-border-hairline bg-background/75 p-0.5 shadow-soft">
                {TYPE_FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`inline-flex flex-1 items-center justify-center rounded-md px-2 text-xs font-medium transition-all active:scale-[0.98] ${
                      typeFilter === value
                        ? "bg-accent text-white shadow-soft"
                        : "text-muted-foreground hover:bg-accent-tint hover:text-accent"
                    }`}
                    onClick={() => setTypeFilter(value)}
                    aria-pressed={typeFilter === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {words.length > 0 && !loading && (
                <button
                  type="button"
                  className={`${toolbarPrimaryButtonClass} shrink-0`}
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
            {isInitialLoading && (
              <div className="space-y-2 py-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-base-300/60 animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty: nothing saved for this filter */}
            {!isInitialLoading && !showingSearch && displayItems.length === 0 && (
              <div className="rounded-xl surface-card p-6 text-center">
                <div className="mb-2 text-4xl">
                  {typeFilter === "sentences" ? "📝" : "📖"}
                </div>
                <p className="text-sm text-muted-foreground">{emptyCopy}</p>
              </div>
            )}

            {/* Search results as flat rows (relevance order) */}
            {!isInitialLoading && showingSearch && (
              <div className="space-y-1">
                {displayItems.length === 0 ? (
                  <div className="rounded-xl surface-card p-6 text-center">
                    <div className="mb-2 text-3xl">🔍</div>
                    <p className="text-sm text-muted-foreground">
                      找不到符合「{debouncedSearchQuery || searchQuery.trim()}」的內容
                    </p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {displayItems.map(renderFeedItem)}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* Date groups as rows */}
            {!isInitialLoading && !showingSearch && displayItems.length > 0 && (
              <div className="space-y-4">
                {feedGroups.map((group) => (
                  <div key={group.date}>
                    <h2 className="sticky top-0 z-10 mb-1 flex items-center gap-2 rounded-lg toolbar px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-accent/60" />
                      {group.date}
                      <span className="rounded-full bg-base-200 px-1.5 py-0.5 text-[10px] font-normal">
                        {group.items.length}
                      </span>
                    </h2>
                    <div className="space-y-1">
                      <AnimatePresence mode="popLayout">
                        {group.items.map(renderFeedItem)}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
                <div ref={loadMoreRef} className="py-4 text-center">
                  {mergedFeed.hasMore && (isLoadingMore || sentencesLoading) && (
                    <span className="loading loading-spinner loading-md text-primary" />
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Detail pane (desktop only) */}
        <section className="hidden min-h-0 flex-1 overflow-y-auto rounded-2xl surface-card p-6 lg:block">
          {selected?.kind === "word" ? (
            <WordDetailPanel
              key={selected.word.id}
              word={selected.word}
              onUpdateWord={handleUpdateWord}
              onRegenerateWordDetails={regenerateWordDetails}
              availableTags={availableTags}
            />
          ) : selected?.kind === "sentence" ? (
            <SentenceDetailPanel
              key={selected.sentence.id}
              sentence={selected.sentence}
              onAddKeyWord={handleAddKeyWord}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <div className="mb-3 text-5xl">📖</div>
              <p className="text-sm">選擇一個項目以查看詳情</p>
            </div>
          )}
        </section>
      </div>

      {/* Mobile / tablet: detail as a modal sheet */}
      {!isDesktop && selected?.kind === "word" && (
        <WordDetail
          word={selected.word}
          onClose={() => setSelected(null)}
          onUpdateWord={handleUpdateWord}
          onRegenerateWordDetails={regenerateWordDetails}
          availableTags={availableTags}
        />
      )}
      {!isDesktop && selected?.kind === "sentence" && (
        <SentenceDetail
          sentence={selected.sentence}
          onClose={() => setSelected(null)}
          onAddKeyWord={handleAddKeyWord}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={pendingDelete !== null}
        title={pendingDelete?.kind === "sentence" ? "刪除句子" : "刪除單字"}
        message={
          pendingDelete?.kind === "sentence"
            ? "確定要刪除這個句子嗎？此操作無法復原。"
            : "確定要刪除這個單字嗎？此操作無法復原。"
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        confirmText="刪除"
        cancelText="取消"
        confirmVariant="error"
        isLoading={isDeleting}
      />
    </div>
  );
};
