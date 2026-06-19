import { memo, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFloatingPanel } from "../../hooks/useFloatingPanel";
import { useVocabularySearch } from "../../hooks/useVocabularySearch";
import { useSettings } from "../../hooks/useSettings";
import type { LookupItem } from "../../hooks/useLookupQueue";
import type { VocabularyWord } from "../../types/vocabulary";
import { LookupResultCard } from "./LookupResultCard";

// --- Inline SVG Icons ---

const BookMarkedIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 2v7l2.5-2L14 9V2" />
  </svg>
);

const SearchIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SpeakerIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const MinusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14" />
  </svg>
);

const XIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
  </svg>
);

const ReturnIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 10l-5 5 5 5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 4v7a4 4 0 01-4 4H4" />
  </svg>
);

// --- Types ---

interface WordPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (text: string) => void;
  onLookupWord: (word: string) => void;
}

// --- Saved word detail (expanded inline) ---

const WordDetail = memo(
  ({
    word,
    onSpeak,
    showChinese,
  }: {
    word: VocabularyWord;
    onSpeak?: (text: string) => void;
    showChinese: boolean;
  }) => (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="pt-2 space-y-2">
        {/* Definitions */}
        {word.definitions.length > 0 && (
          <div className="space-y-1">
            {word.definitions.map((def, i) => (
              <div key={i} className="text-sm">
                <span className="text-accent font-medium italic">
                  {def.partOfSpeech}
                </span>
                <span className="text-base-content/70 ml-1.5">
                  {def.definition || def.definitionChinese}
                </span>
                {showChinese && def.definitionChinese && def.definition && (
                  <span className="text-base-content/50 ml-1">
                    ({def.definitionChinese})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Examples */}
        {word.examples.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {word.examples.map((ex, i) => (
              <div
                key={i}
                className="text-sm pl-2 border-l-2 border-base-content/10"
              >
                <div className="flex items-start gap-1">
                  <p className="text-base-content/70 italic flex-1">
                    {ex.sentence}
                  </p>
                  {onSpeak && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpeak(ex.sentence);
                      }}
                      className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10 shrink-0 mt-0.5"
                      aria-label="朗讀例句"
                    >
                      <SpeakerIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {ex.translation && (
                  <p className="text-base-content/50 text-xs mt-0.5">
                    {ex.translation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {word.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {word.tags.map((tag) => (
              <span key={tag} className="badge badge-xs badge-ghost">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  ),
);

WordDetail.displayName = "WordDetail";

// --- Saved word row (compact, expandable) ---

const SavedWordItem = memo(
  ({
    word,
    isExpanded,
    onToggle,
    onSpeak,
    showChinese,
  }: {
    word: VocabularyWord;
    isExpanded: boolean;
    onToggle: () => void;
    onSpeak?: (text: string) => void;
    showChinese: boolean;
  }) => (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      onClick={onToggle}
      className={`rounded-lg border border-border-hairline p-2.5 cursor-pointer transition-colors ${
        isExpanded
          ? "border-l-4 border-l-accent bg-accent-tint"
          : "hover:bg-base-200/60"
      }`}
    >
      {/* Compact header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {word.emoji && <span className="text-sm">{word.emoji}</span>}
          <span className="font-semibold text-sm truncate">{word.word}</span>
          {word.phonetic && (
            <span className="text-xs text-base-content/40 truncate">
              {word.phonetic}
            </span>
          )}
          {onSpeak && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpeak(word.word);
              }}
              className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
              aria-label="朗讀單字"
            >
              <SpeakerIcon />
            </button>
          )}
        </div>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-base-content/40 shrink-0 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Brief definition preview when collapsed */}
      {!isExpanded && word.definitions.length > 0 && (
        <p className="text-xs text-base-content/50 mt-1 truncate">
          {showChinese && word.definitions[0].definitionChinese
            ? word.definitions[0].definitionChinese
            : word.definitions[0].definition || word.definitions[0].definitionChinese}
        </p>
      )}

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <WordDetail word={word} onSpeak={onSpeak} showChinese={showChinese} />
        )}
      </AnimatePresence>
    </motion.div>
  ),
);

SavedWordItem.displayName = "SavedWordItem";

// --- Main unified panel ---

export const WordPanel = memo(
  ({
    isOpen,
    onClose,
    lookups,
    onDismiss,
    onDismissAll,
    onSpeak,
    onLookupWord,
  }: WordPanelProps) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { showChineseTranslation, updateShowChineseTranslation } = useSettings();
    const { query, setQuery, results, isSearching, clearSearch } =
      useVocabularySearch();

    const {
      panelStyle,
      dragHandleProps,
      resizeHandleProps,
      isDragging,
      isResizing,
    } = useFloatingPanel({
      defaultPosition: {
        x: window.innerWidth - 360 - 24,
        y: window.innerHeight - 480 - 24,
      },
      defaultSize: { width: 360, height: 480 },
      minSize: { width: 260, height: 240 },
      maxSize: { width: 560, height: 760 },
    });

    // Focus the search input when the panel opens; reset state on close. The
    // reset runs in cleanup (when isOpen flips back to false) rather than in the
    // effect body, which avoids the cascading-render lint while keeping the same
    // reset-on-close behaviour (clearSearch is a stable useCallback).
    useEffect(() => {
      if (!isOpen) return;
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => {
        clearTimeout(timer);
        setExpandedId(null);
        clearSearch();
      };
    }, [isOpen, clearSearch]);

    const handleToggleExpand = (wordId: string) => {
      setExpandedId((prev) => (prev === wordId ? null : wordId));
    };

    const handleLookupSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const word = query.trim();
      if (!word) return;
      onLookupWord(word);
    };

    if (!isOpen) return null;

    const disableItemLayoutAnimation = isDragging || isResizing;
    const trimmedQuery = query.trim();
    const normalizedQuery = trimmedQuery.toLowerCase();
    const activeCount = lookups.filter((l) => l.status === "loading").length;
    const hasCompleted = lookups.some((l) => l.status !== "loading");

    // Queue cards: all of them when idle, or only those matching the term when
    // searching — keeps the merged list focused on what was typed.
    const visibleLookups = trimmedQuery
      ? lookups.filter((l) => l.word.toLowerCase().includes(normalizedQuery))
      : lookups;

    const savedResults = results ?? [];
    const exactSavedMatch = savedResults.some(
      (w) => w.word.toLowerCase() === normalizedQuery,
    );
    const queryLoadingInQueue = lookups.some(
      (l) =>
        l.type === "word" &&
        l.status === "loading" &&
        l.word.toLowerCase() === normalizedQuery,
    );

    // Saved matches, de-duplicated against any queue card for the same word so a
    // freshly looked-up word never shows twice.
    const visibleSaved = trimmedQuery
      ? savedResults.filter(
          (w) =>
            !visibleLookups.some(
              (l) =>
                l.type === "word" &&
                l.word.toLowerCase() === w.word.toLowerCase(),
            ),
        )
      : [];

    // Offer to look the typed term up as a new word unless it's already saved or
    // already being looked up.
    const showLookupCTA =
      Boolean(trimmedQuery) && !exactSavedMatch && !queryLoadingInQueue;
    const showGroupLabels =
      Boolean(trimmedQuery) &&
      visibleLookups.length > 0 &&
      visibleSaved.length > 0;
    const showLandingHint = !trimmedQuery && lookups.length === 0;
    const showNoSavedHint =
      Boolean(trimmedQuery) &&
      !isSearching &&
      results !== null &&
      visibleSaved.length === 0 &&
      visibleLookups.length === 0;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{ ...panelStyle, overflow: "hidden" }}
          className="bg-base-100/90 backdrop-blur-xl rounded-2xl border border-border-hairline shadow-floating flex flex-col"
        >
          {/* Header — draggable */}
          <div
            {...dragHandleProps}
            style={{
              ...dragHandleProps.style,
              cursor: isDragging ? "grabbing" : "grab",
            }}
            className="flex items-center justify-between px-4 py-3 border-b border-border-hairline shrink-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <BookMarkedIcon className="w-4 h-4 text-accent shrink-0" />
              <span className="font-semibold text-base truncate">生詞本</span>
              {activeCount > 0 && (
                <span className="badge badge-xs badge-accent shrink-0">
                  {activeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Chinese translation toggle */}
              <label
                className="flex items-center gap-1.5 px-2 cursor-pointer text-xs select-none"
                title={showChineseTranslation ? "隱藏中文翻譯" : "顯示中文翻譯"}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-base-content/60">中</span>
                <input
                  type="checkbox"
                  className="toggle toggle-xs toggle-accent"
                  checked={showChineseTranslation}
                  onChange={(e) => updateShowChineseTranslation(e.target.checked)}
                />
              </label>
              {hasCompleted && (
                <button
                  type="button"
                  onClick={onDismissAll}
                  className="btn btn-ghost btn-xs hover:bg-black/5 dark:hover:bg-white/10"
                >
                  清除
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="收合面板"
              >
                <MinusIcon />
              </button>
            </div>
          </div>

          {/* Unified search box — type to search the book, Enter to look up a new word */}
          <div className="px-3 py-2 border-b border-border-hairline shrink-0">
            <form
              onSubmit={handleLookupSubmit}
              onPointerDown={(e) => e.stopPropagation()}
              className="relative"
            >
              <SearchIcon className="w-4 h-4 text-base-content/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋或查詢單字…"
                aria-label="搜尋或查詢單字"
                className="w-full h-9 rounded-[8px] border border-border-hairline bg-base-200/50 pl-9 pr-9 text-sm placeholder:text-base-content/40 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/40 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="清除搜尋"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </form>
          </div>

          {/* Merged list */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {/* Lookup CTA — look the typed term up as a new word */}
            {showLookupCTA && (
              <button
                type="button"
                onClick={() => onLookupWord(trimmedQuery)}
                className="flex items-center gap-2 w-full text-left rounded-lg border border-accent/20 bg-accent-tint px-3 py-2.5 text-sm text-accent hover:bg-accent/15 active:scale-[0.99] transition-all duration-200"
              >
                <SearchIcon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">
                  查詢「{trimmedQuery}」並加入生詞本
                </span>
                <ReturnIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />
              </button>
            )}

            {/* Lookup queue */}
            {visibleLookups.length > 0 && (
              <>
                {showGroupLabels && (
                  <p className="text-xs text-base-content/40 px-1 pt-0.5">查詢結果</p>
                )}
                <AnimatePresence initial={false}>
                  {visibleLookups.map((item) => (
                    <LookupResultCard
                      key={item.id}
                      item={item}
                      onDismiss={onDismiss}
                      onSpeak={onSpeak}
                      showChinese={showChineseTranslation}
                      disableLayoutAnimation={disableItemLayoutAnimation}
                    />
                  ))}
                </AnimatePresence>
              </>
            )}

            {/* Searching the saved book */}
            {trimmedQuery && isSearching && (
              <div className="flex items-center justify-center gap-2 py-4">
                <span className="loading loading-spinner loading-sm text-accent" />
                <span className="text-sm text-base-content/50">搜尋中...</span>
              </div>
            )}

            {/* Saved vocabulary matches */}
            {visibleSaved.length > 0 && (
              <>
                {showGroupLabels && (
                  <p className="text-xs text-base-content/40 px-1 pt-0.5">生詞本</p>
                )}
                <AnimatePresence initial={false}>
                  {visibleSaved.map((word) => (
                    <SavedWordItem
                      key={word.id ?? word.word}
                      word={word}
                      isExpanded={expandedId === (word.id ?? word.word)}
                      onToggle={() => handleToggleExpand(word.id ?? word.word)}
                      onSpeak={onSpeak}
                      showChinese={showChineseTranslation}
                    />
                  ))}
                </AnimatePresence>
              </>
            )}

            {/* No saved match (the CTA above offers to look it up) */}
            {showNoSavedHint && (
              <p className="text-center text-sm text-base-content/40 px-4 py-2">
                生詞本沒有「{trimmedQuery}」
              </p>
            )}

            {/* Landing state — nothing typed and no active lookups */}
            {showLandingHint && (
              <div className="flex flex-col items-center justify-center h-full text-base-content/40 text-sm text-center px-4">
                <SearchIcon className="w-8 h-8 mb-2 text-base-content/20" />
                <p>搜尋生詞本，或輸入單字查詢</p>
              </div>
            )}
          </div>

          {/* Resize handle */}
          <div
            {...resizeHandleProps}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          >
            <svg
              className="w-3 h-3 text-base-content/20 absolute bottom-0.5 right-0.5"
              viewBox="0 0 6 6"
            >
              <circle cx="4.5" cy="1.5" r="0.75" fill="currentColor" />
              <circle cx="1.5" cy="4.5" r="0.75" fill="currentColor" />
              <circle cx="4.5" cy="4.5" r="0.75" fill="currentColor" />
            </svg>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  },
);

WordPanel.displayName = "WordPanel";
