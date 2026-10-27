import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import {
  CircleAlert,
  CircleCheck,
  CornerDownLeft,
  Search,
  X,
} from "lucide-react";
import { useVocabulary } from "../../hooks/useVocabulary";
import { useSentenceTranslation } from "../../hooks/useSentenceTranslation";
import { useDebounce } from "../../hooks/useDebounce";
import { useCefrLevels } from "../../hooks/useCefrLevels";
import { smartLookup } from "../../services/aiService";
import { isGeminiRateLimitError } from "../../services/geminiErrorPolicy";
import type { VocabularyWord, VocabularyFilters } from "../../types/vocabulary";
import type { SentenceTranslation } from "../../types/sentenceTranslation";
import { WordDetail } from "./WordDetail";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";
import { T } from "../common/T";
import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey, MessageParams } from "../../i18n/translate";

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
import {
  findExactFeedItem,
  mergeFeedItems,
  searchFeedItems,
  stripEdgePunctuation,
  toSearchKey,
} from "../../utils/vocabularySearch";

// The feed is always newest-first; sorting UI was removed with the tab merge.
const FEED_FILTERS: VocabularyFilters = {
  sortBy: "createdAt",
  sortOrder: "desc",
};

// Account-wide word matches fetched per search. Local (already loaded) matches
// are shown as well, so this only bounds what the prefix query pulls down.
const REMOTE_WORD_SEARCH_LIMIT = 50;

// Han + kana + hangul — the smart query only handles English input.
const CJK_PATTERN = /\p{Script=Han}|[぀-ヿ가-힯]/u;

type Translate = (key: MessageKey, params?: MessageParams) => string;

// The hint already says how to retry, so a message's own "請稍後再試" and
// final punctuation would read twice ("查詢失敗，請稍後再試，按 Enter…").
const RETRY_LATER_SUFFIX =
  /[，,.\s]*(?:請稍後再試|please try again later)[\s。.!！]*$/iu;
const TRAILING_PUNCTUATION = /[\s.,;:!?。，、；：！？…]+$/u;

const toRetryHint = (message: string, t: Translate): string => {
  const reason =
    message
      .replace(RETRY_LATER_SUFFIX, "")
      .replace(TRAILING_PUNCTUATION, "") || t("reader.lookup.lookupFailed");
  return t("reader.vocab.retryHint", { reason });
};

const TYPE_FILTERS: Array<{ value: FeedTypeFilter; label: MessageKey }> = [
  { value: "all", label: "reader.vocab.filter.all" },
  { value: "words", label: "reader.vocab.filter.words" },
  { value: "sentences", label: "reader.vocab.filter.sentences" },
];

const wordItem = (word: VocabularyWord): FeedItem => ({ kind: "word", word });

const sentenceItem = (sentence: SentenceTranslation): FeedItem => ({
  kind: "sentence",
  sentence,
});

const feedItemId = (item: FeedItem): string | undefined =>
  item.kind === "word" ? item.word.id : item.sentence.id;

type LookupOutcome =
  | { status: "added" | "existing"; item: FeedItem }
  | { status: "failed"; message: string }
  | { status: "aborted" };

interface FocusRequest {
  /** Select the kept text so typing the next entry replaces it. */
  selectAll: boolean;
  /** What had focus when the lookup started (the field or the add button). */
  trigger: Element | null;
}

/**
 * Where focus goes once a lookup settles. The field takes it back so the next
 * word can be typed right away — unless the user has since moved on to
 * something else. On touch screens a detail sheet opened over the field
 * dismisses the keyboard instead of popping it up behind the sheet.
 */
function settleQueryFocus(
  input: HTMLInputElement,
  { selectAll, trigger }: FocusRequest,
  { isDesktop, sheetOpen }: { isDesktop: boolean; sheetOpen: boolean },
) {
  if (!isDesktop && sheetOpen) {
    input.blur();
    return;
  }
  const active = document.activeElement;
  const movedOn =
    active !== null &&
    active !== document.body &&
    active !== input &&
    active !== trigger &&
    !input.form?.contains(active);
  if (movedOn) return;
  input.focus();
  if (selectAll) {
    input.select();
  } else {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }
}

export const VocabularyBook = () => {
  const { t } = useLanguage();
  const LOOKUP_FAILED_MESSAGE = t("reader.vocab.lookupFailedRetry");
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
    searchWords,
    availableTags,
    loadAllTags,
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
    searchSentences,
  } = useSentenceTranslation();
  const { levelOf } = useCefrLevels();
  const isDesktop = useIsDesktop();

  // One field for both: typing searches the saved items, submitting looks the
  // text up and saves it (or opens the saved entry when it already exists).
  const [query, setQuery] = useState("");
  // Text being looked up and saved; null while idle.
  const [pendingText, setPendingText] = useState<string | null>(null);
  const isQuerying = pendingText !== null;
  // Why the last submit failed; cleared as soon as the text changes.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>("all");
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const debouncedQuery = useDebounce(query, 300);
  const isSearchActive = query.trim().length > 0;
  const queryKey = toSearchKey(query);
  // Clearing the field (or adding, which clears it) restores the full list
  // right away instead of waiting out the debounce.
  const remoteSearchKey = isSearchActive ? toSearchKey(debouncedQuery) : "";
  const [remoteResults, setRemoteResults] = useState<{
    key: string;
    items: FeedItem[];
  } | null>(null);
  const isSearching =
    isSearchActive && queryKey !== "" && remoteResults?.key !== queryKey;
  const isEnglishQuery = !CJK_PATTERN.test(query);
  const canAdd = queryKey !== "" && isEnglishQuery;

  const [toastMessage, setToastMessage] = useState<{
    message: ReactNode;
    type: "success" | "error" | "info";
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "word" | "sentence";
    id: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const smartQueryFieldId = "smart-query-input";
  const smartQueryStatusId = "smart-query-status";
  const smartQueryInputRef = useRef<HTMLInputElement>(null);
  const pendingFocusRef = useRef<FocusRequest | null>(null);
  // Set synchronously, unlike pendingText, so a second Enter in the same
  // tick cannot start a second lookup and save.
  const isSubmittingRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const queryAbortRef = useRef<AbortController | null>(null);

  const closeToast = useCallback(() => setToastMessage(null), []);

  // Load both streams when the component mounts (or the user changes)
  useEffect(() => {
    void loadVocabulary(FEED_FILTERS);
  }, [loadVocabulary]);

  useEffect(() => {
    void loadSentences();
  }, [loadSentences]);

  // Abort an in-flight smart query when leaving the page
  useEffect(() => {
    return () => {
      queryAbortRef.current?.abort();
    };
  }, []);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setSubmitError(null);
    if (!value.trim()) setRemoteResults(null);
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

  const loadedItems = useMemo(
    () => [...words.map(wordItem), ...sentences.map(sentenceItem)],
    [words, sentences],
  );

  // Every saved item matching the text, best match first. Loaded items are
  // filtered on each keystroke; account-wide results join once the debounced
  // search returns. The loaded copy wins, so edits made here show up.
  const searchItems = useMemo(
    () =>
      isSearchActive
        ? searchFeedItems(
            mergeFeedItems(loadedItems, remoteResults?.items ?? []),
            query,
          )
        : null,
    [isSearchActive, loadedItems, remoteResults, query],
  );

  const exactMatch = useMemo(
    () => (searchItems ? findExactFeedItem(searchItems, query) : null),
    [searchItems, query],
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

  // Account-wide search: words come from a bounded Firestore prefix query,
  // sentences from the hook's in-memory copy of the book. A newer query (or
  // leaving the page) discards the result of an older one.
  useEffect(() => {
    if (!remoteSearchKey) return;

    let cancelled = false;
    const performSearch = async () => {
      try {
        const [remoteWords, remoteSentences] = await Promise.all([
          searchWords(remoteSearchKey, {
            mode: "prefix",
            limit: REMOTE_WORD_SEARCH_LIMIT,
          }),
          searchSentences(remoteSearchKey),
        ]);
        if (cancelled) return;
        setRemoteResults({
          key: remoteSearchKey,
          items: [
            ...remoteWords.map(wordItem),
            ...remoteSentences.map(sentenceItem),
          ],
        });
      } catch (error) {
        console.error("Search failed:", error);
        if (cancelled) return;
        setRemoteResults({ key: remoteSearchKey, items: [] });
      }
    };

    void performSearch();
    return () => {
      cancelled = true;
    };
  }, [remoteSearchKey, searchWords, searchSentences]);

  // A single word looks up the dictionary directly; multi-word input is
  // classified by AI as a phrase (saved as a word) or a sentence (translated
  // and saved). Anything already saved is returned without calling AI.
  const lookUpAndSave = async (
    text: string,
    signal: AbortSignal,
  ): Promise<LookupOutcome> => {
    const stripped = stripEdgePunctuation(text);
    const failed = (message?: string): LookupOutcome => ({
      status: "failed",
      message: message || LOOKUP_FAILED_MESSAGE,
    });

    if (!stripped.includes(" ")) {
      const res = await lookupOrAddWord(stripped, undefined, signal);
      if (signal.aborted) return { status: "aborted" };
      if (!res.success || !res.existingWord) return failed(res.message);
      return {
        status: res.isNew ? "added" : "existing",
        item: wordItem(res.existingWord),
      };
    }

    const existingWord = await findExistingWord(stripped);
    if (signal.aborted) return { status: "aborted" };
    if (existingWord) return { status: "existing", item: wordItem(existingWord) };

    // Sentences keep their punctuation, so the exact lookup misses a saved
    // copy typed with different punctuation; the searchable copy of the book
    // catches that before AI is asked again.
    const sentence = text.trim().replace(/\s+/g, " ");
    const existingSentence = await findExistingSentence(sentence);
    if (signal.aborted) return { status: "aborted" };
    if (existingSentence) {
      return { status: "existing", item: sentenceItem(existingSentence) };
    }
    const lookalikeSentence = findExactFeedItem(
      (await searchSentences(stripped)).map(sentenceItem),
      sentence,
    );
    if (signal.aborted) return { status: "aborted" };
    if (lookalikeSentence) {
      return { status: "existing", item: lookalikeSentence };
    }

    const result = await smartLookup(sentence, signal);
    if (signal.aborted) return { status: "aborted" };
    if (!result) return failed();

    if (result.kind === "word") {
      const res = await addWordFromDetails(stripped, result.details);
      if (signal.aborted) return { status: "aborted" };
      if (!res.success || !res.word) return failed(res.message);
      return {
        status: res.existing ? "existing" : "added",
        item: wordItem(res.word),
      };
    }

    const saved = await addTranslatedSentence(
      sentence,
      result.chinese,
      result.keyWords,
    );
    if (signal.aborted) return { status: "aborted" };
    if (!saved) return failed(t("reader.vocab.saveSentenceFailed"));
    return { status: "added", item: sentenceItem(saved) };
  };

  const showExisting = (item: FeedItem) => {
    setSelected(item);
    setToastMessage({
      message:
        item.kind === "word"
          ? <T k="reader.vocab.wordExists" params={{ word: item.word.word }} />
          : <T k="reader.vocab.sentenceExists" />,
      type: "info",
    });
  };

  const submitQuery = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSubmittingRef.current) return;

    if (CJK_PATTERN.test(trimmed) || !stripEdgePunctuation(trimmed)) {
      setToastMessage({
        message: <T k="reader.vocab.englishOnly" />,
        type: "info",
      });
      return;
    }

    const trigger = document.activeElement;
    const known = findExactFeedItem(
      mergeFeedItems(loadedItems, remoteResults?.items ?? []),
      trimmed,
    );
    if (known) {
      showExisting(known);
      const input = smartQueryInputRef.current;
      if (input) {
        settleQueryFocus(
          input,
          { selectAll: true, trigger },
          { isDesktop, sheetOpen: true },
        );
      }
      return;
    }

    queryAbortRef.current?.abort();
    const controller = new AbortController();
    queryAbortRef.current = controller;
    const { signal } = controller;

    isSubmittingRef.current = true;
    setPendingText(stripEdgePunctuation(trimmed));
    setSubmitError(null);
    let outcome: LookupOutcome = { status: "aborted" };
    try {
      outcome = await lookUpAndSave(trimmed, signal);
    } catch (error) {
      console.error("Smart lookup failed:", error);
      outcome = signal.aborted
        ? { status: "aborted" }
        : {
            status: "failed",
            message: isGeminiRateLimitError(error)
              ? error.message
              : LOOKUP_FAILED_MESSAGE,
          };
    } finally {
      isSubmittingRef.current = false;
      setPendingText(null);
    }

    if (outcome.status === "aborted") return;
    pendingFocusRef.current = {
      selectAll: outcome.status === "existing",
      trigger,
    };

    if (outcome.status === "failed") {
      setSubmitError(outcome.message);
      setToastMessage({ message: outcome.message, type: "error" });
      return;
    }

    if (outcome.status === "existing") {
      showExisting(outcome.item);
      return;
    }

    const { item } = outcome;
    // On touch screens the detail is a modal sheet; keep the field free so
    // the next word can be typed straight away. The toast confirms the add.
    if (isDesktop) setSelected(item);
    changeQuery("");
    if (item.kind === "word") {
      setToastMessage({
        message: (
          <T k="reader.vocab.wordAdded" params={{ word: item.word.word }} />
        ),
        type: "success",
      });
      void loadVocabulary(FEED_FILTERS);
    } else {
      setToastMessage({
        message: <T k="reader.vocab.sentenceAdded" />,
        type: "success",
      });
      void loadSentences();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuery(query);
  };

  // Settle focus once the lookup's result has rendered (detail pane, toast).
  useEffect(() => {
    if (isQuerying) return;
    const request = pendingFocusRef.current;
    const input = smartQueryInputRef.current;
    if (!request || !input) return;
    pendingFocusRef.current = null;
    settleQueryFocus(input, request, {
      isDesktop,
      sheetOpen: selected !== null,
    });
  }, [isQuerying, isDesktop, selected]);

  // Add a key word from a sentence's chips to the vocabulary book
  const handleAddKeyWord = useCallback(
    async (word: string) => {
      const response = await addWord(word);
      if (response.success) {
        setToastMessage({
          message: <T k="reader.vocab.wordAdded" params={{ word }} />,
          type: "success",
        });
        void loadVocabulary(FEED_FILTERS);
        return { success: true };
      }
      if (response.message === "Word already in vocabulary") {
        setToastMessage({
          message: <T k="reader.vocab.wordExists" params={{ word }} />,
          type: "info",
        });
        return { success: true, existed: true };
      }
      setToastMessage({
        message: response.message || (
          <T k="reader.vocab.addFailed" />
        ),
        type: "error",
      });
      return { success: false, message: response.message };
    },
    [addWord, loadVocabulary],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    const isDeletedItem = (item: FeedItem) =>
      item.kind === pendingDelete.kind && feedItemId(item) === pendingDelete.id;

    setIsDeleting(true);
    try {
      if (pendingDelete.kind === "word") {
        const result = await deleteWord(pendingDelete.id);
        if (!result.success) {
          throw new Error(result.message || "Failed to delete word");
        }
      } else {
        const result = await deleteSentence(pendingDelete.id);
        if (!result.success) {
          throw new Error(result.message || "Failed to delete sentence");
        }
      }
      // The hooks drop the item from the loaded lists; search results fetched
      // before the delete still hold a copy.
      setRemoteResults(
        (prev) =>
          prev && {
            ...prev,
            items: prev.items.filter((item) => !isDeletedItem(item)),
          },
      );
      if (selected && isDeletedItem(selected)) {
        setSelected(null);
      }
      setToastMessage({
        message: (
          <T
            k={
              pendingDelete.kind === "word"
                ? "reader.vocab.wordDeleted"
                : "reader.vocab.sentenceDeleted"
            }
          />
        ),
        type: "success",
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      setToastMessage({
        message: <T k="reader.vocab.deleteFailed" />,
        type: "error",
      });
      return;
    } finally {
      setIsDeleting(false);
    }
    setPendingDelete(null);
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
    if (!isSearchActive && mergedFeed.items.length > 0) {
      setSelected(mergedFeed.items[0]);
    }
  }, [isDesktop, selected, loading, sentencesLoading, isSearchActive, mergedFeed.items]);

  const showingSearch = searchItems !== null;
  const isInitialLoading =
    !showingSearch &&
    ((loading && words.length === 0) ||
      (sentencesLoading && sentences.length === 0));

  const typedText = stripEdgePunctuation(query);

  const emptyCopyKey: MessageKey =
    typeFilter === "sentences"
      ? "reader.vocab.empty.sentences"
      : typeFilter === "words"
        ? "reader.vocab.empty.words"
        : "reader.vocab.empty.all";

  // What Enter will do with the current text, so it never reads as a filter.
  const renderQueryStatus = (): ReactNode => {
    if (pendingText !== null) {
      return (
        <>
          <span className="loading loading-spinner loading-xs shrink-0 text-accent" />
          <span className="truncate text-accent">
            <T k="reader.vocab.status.pending" params={{ text: pendingText }} />
          </span>
        </>
      );
    }
    if (submitError) {
      return (
        <>
          <CircleAlert className="size-3.5 shrink-0 text-error" aria-hidden="true" />
          <span className="truncate text-error">{toRetryHint(submitError, t)}</span>
        </>
      );
    }
    if (!isSearchActive) {
      return (
        <span className="truncate">
          <T k="reader.vocab.status.idle" />
        </span>
      );
    }
    if (!isEnglishQuery) {
      return (
        <span className="truncate">
          <T k="reader.vocab.status.chinese" />
        </span>
      );
    }
    if (!canAdd) {
      return (
        <span className="truncate">
          <T k="reader.vocab.status.needEnglish" />
        </span>
      );
    }
    if (exactMatch) {
      return (
        <>
          <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />
          <span className="truncate">
            <T
              k="reader.vocab.status.exists"
              params={{
                text:
                  exactMatch.kind === "word"
                    ? exactMatch.word.word
                    : exactMatch.sentence.english,
              }}
            />
          </span>
        </>
      );
    }
    return (
      <>
        <CornerDownLeft className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          <T k="reader.vocab.status.enterToAdd" params={{ text: typedText }} />
        </span>
      </>
    );
  };

  const renderFeedItem = (item: FeedItem) => {
    if (item.kind === "word") {
      const { word } = item;
      return (
        <VocabularyRow
          key={feedItemKey(item)}
          word={word}
          cefr={levelOf(word.word)}
          isActive={selected?.kind === "word" && selected.word.id === word.id}
          onSelect={() => setSelected({ kind: "word", word })}
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
          onClose={closeToast}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-6">
        {/* List pane */}
        <aside className="flex min-h-0 flex-1 flex-col lg:w-72 lg:flex-none lg:shrink-0 xl:w-80 2xl:w-96">
          {/* Compact toolbar */}
          <div className="shrink-0 space-y-2">
            <div>
              <form className="flex gap-2" onSubmit={handleSubmit}>
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <input
                    ref={smartQueryInputRef}
                    id={smartQueryFieldId}
                    // A search field, not a login form: keeps iOS from offering
                    // passwords, addresses and cards above the keyboard.
                    type="search"
                    placeholder={t("reader.vocab.inputPlaceholder")}
                    aria-label={t("reader.vocab.inputPlaceholder")}
                    aria-describedby={smartQueryStatusId}
                    className={`${toolbarFieldClass} w-full pl-9 [&::-webkit-search-cancel-button]:appearance-none ${query ? "pr-11" : ""}`}
                    value={query}
                    onChange={(e) => changeQuery(e.target.value)}
                    // readOnly (not disabled) so the field keeps focus while querying
                    readOnly={isQuerying}
                    aria-busy={isQuerying}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="search"
                  />
                  {query && !isQuerying && (
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => {
                        changeQuery("");
                        smartQueryInputRef.current?.focus();
                      }}
                      aria-label={t("reader.vocab.clearInput")}
                      title={t("reader.vocab.clearInput")}
                    >
                      <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className={toolbarPrimaryButtonClass}
                  disabled={isQuerying || !canAdd}
                  aria-label={t("reader.vocab.addLabel")}
                  title={t("reader.vocab.addTitle")}
                >
                  {isQuerying ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <T k="reader.vocab.add" />
                  )}
                </button>
              </form>
              <p
                id={smartQueryStatusId}
                className="mt-1 flex h-5 min-w-0 items-center gap-1.5 px-1 text-xs text-muted-foreground"
              >
                {renderQueryStatus()}
              </p>
            </div>

            <div className="flex h-11 gap-1 rounded-lg border border-border-hairline bg-background/75 p-0.5 shadow-soft">
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
                  <T k={label} />
                </button>
              ))}
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
                <p className="text-sm text-muted-foreground">
                  <T k={emptyCopyKey} />
                </p>
              </div>
            )}

            {/* Saved items matching the text (relevance order) */}
            {!isInitialLoading && showingSearch && (
              <div className="space-y-1">
                <h2 className="flex items-center justify-between gap-2 px-2 pb-1 text-xs font-semibold text-muted-foreground">
                  <span>
                    <T k="reader.vocab.searchResults" />
                  </span>
                  <span className="flex items-center gap-1 font-normal">
                    {isSearching && (
                      <span className="loading loading-spinner loading-xs" />
                    )}
                    {isSearching ? (
                      <T k="reader.vocab.searchingSaved" />
                    ) : (
                      <T
                        k="reader.vocab.resultCount"
                        params={{ count: displayItems.length }}
                      />
                    )}
                  </span>
                </h2>
                {displayItems.length > 0 ? (
                  <AnimatePresence mode="popLayout">
                    {displayItems.map(renderFeedItem)}
                  </AnimatePresence>
                ) : isSearching ? null : (
                  <div className="rounded-xl surface-card p-6 text-center">
                    <div className="mb-2 text-3xl">🔍</div>
                    <p className="text-sm text-muted-foreground">
                      <T k="reader.vocab.noMatch" params={{ query: query.trim() }} />
                    </p>
                    {canAdd && (
                      <button
                        type="button"
                        className={`${toolbarPrimaryButtonClass} mt-4 max-w-full`}
                        onClick={() => void submitQuery(query)}
                        disabled={isQuerying}
                      >
                        {isQuerying ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <span className="truncate">
                            <T
                              k="reader.vocab.lookupAndAddText"
                              params={{ text: typedText }}
                            />
                          </span>
                        )}
                      </button>
                    )}
                  </div>
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
                    <div className="space-y-0.5">
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
              onUpdateWord={updateWord}
              onRegenerateWordDetails={regenerateWordDetails}
              availableTags={availableTags}
              onTagEditorOpen={loadAllTags}
              cefr={levelOf(selected.word.word)}
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
              <p className="text-sm">
                <T k="reader.vocab.selectItem" />
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Mobile / tablet: detail as a modal sheet */}
      {!isDesktop && selected?.kind === "word" && (
        <WordDetail
          word={selected.word}
          onClose={() => setSelected(null)}
          onUpdateWord={updateWord}
          onRegenerateWordDetails={regenerateWordDetails}
          availableTags={availableTags}
          onTagEditorOpen={loadAllTags}
          cefr={levelOf(selected.word.word)}
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
        title={
          <T
            k={
              pendingDelete?.kind === "sentence"
                ? "reader.vocab.deleteSentenceTitle"
                : "reader.vocab.deleteWordTitle"
            }
          />
        }
        message={
          <T
            k={
              pendingDelete?.kind === "sentence"
                ? "reader.vocab.deleteSentenceConfirm"
                : "reader.vocab.deleteWordConfirm"
            }
          />
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        confirmText={<T k="reader.vocab.delete" />}
        confirmVariant="error"
        isLoading={isDeleting}
      />
    </div>
  );
};
