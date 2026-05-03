import { memo, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFloatingPanel } from "../../hooks/useFloatingPanel";
import { useVocabularySearch } from "../../hooks/useVocabularySearch";
import { useSettings } from "../../hooks/useSettings";
import type { VocabularyWord } from "../../types/vocabulary";

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

// --- Types ---

interface VocabularyBrowserPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeak?: (text: string) => void;
}

// --- Word Detail (expanded inline) ---

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
              <span
                key={tag}
                className="badge badge-xs badge-ghost"
              >
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

// --- Word Item (compact row, expandable) ---

const WordItem = memo(
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      onClick={onToggle}
      className={`rounded-lg border border-black/5 dark:border-white/10 p-2.5 cursor-pointer transition-colors ${
        isExpanded
          ? "border-l-4 border-l-accent bg-accent/5"
          : "hover:bg-black/5 dark:hover:bg-white/10"
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

WordItem.displayName = "WordItem";

// --- Main Panel ---

export const VocabularyBrowserPanel = memo(
  ({ isOpen, onClose, onSpeak }: VocabularyBrowserPanelProps) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { showChineseTranslation, updateShowChineseTranslation } = useSettings();

    const { query, setQuery, results, isSearching, clearSearch } =
      useVocabularySearch();

    const { panelStyle, dragHandleProps, resizeHandleProps, isDragging } =
      useFloatingPanel({
        defaultPosition: { x: 24, y: window.innerHeight - 440 - 24 },
        defaultSize: { width: 340, height: 440 },
        minSize: { width: 260, height: 240 },
        maxSize: { width: 500, height: 600 },
      });

    // Auto-focus the search input when the panel opens
    useEffect(() => {
      if (isOpen) {
        // Small delay so the panel animation can start
        const timer = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(timer);
      }
      // Reset state when closing
      setExpandedId(null);
      clearSearch();
    }, [isOpen, clearSearch]);

    const handleToggleExpand = (wordId: string) => {
      setExpandedId((prev) => (prev === wordId ? null : wordId));
    };

    if (!isOpen) return null;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{ ...panelStyle, overflow: "hidden" }}
          className="bg-base-100/90 backdrop-blur-xl rounded-2xl border border-black/5 dark:border-white/10 shadow-xl flex flex-col"
        >
          {/* Header — draggable */}
          <div
            {...dragHandleProps}
            style={{
              ...dragHandleProps.style,
              cursor: isDragging ? "grabbing" : "grab",
            }}
            className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/10 shrink-0"
          >
            <div className="flex items-center gap-2">
              <BookMarkedIcon className="w-4 h-4 text-accent" />
              <span className="font-semibold text-base">生詞本</span>
            </div>
            <div className="flex items-center gap-1">
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
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="收合面板"
              >
                <MinusIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSearch();
                  onClose();
                }}
                className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="關閉面板"
              >
                <XIcon />
              </button>
            </div>
          </div>

          {/* Search input — sticky below header */}
          <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 shrink-0">
            <div className="relative">
              <SearchIcon className="w-4 h-4 text-base-content/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋單字..."
                className="input input-bordered input-sm w-full pl-8 pr-8"
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
            </div>
          </div>

          {/* Scrollable results area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {/* No search yet */}
            {!query.trim() && !isSearching && results === null && (
              <div className="flex flex-col items-center justify-center h-full text-base-content/40 text-sm text-center px-4">
                <SearchIcon className="w-8 h-8 mb-2 text-base-content/20" />
                <p>輸入單字來搜尋生詞本</p>
              </div>
            )}

            {/* Searching */}
            {isSearching && (
              <div className="flex items-center justify-center h-full gap-2">
                <span className="loading loading-spinner loading-sm text-accent" />
                <span className="text-sm text-base-content/50">搜尋中...</span>
              </div>
            )}

            {/* No results */}
            {!isSearching && results !== null && results.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-base-content/40 text-sm text-center px-4">
                <p>找不到符合的單字</p>
              </div>
            )}

            {/* Results list */}
            {!isSearching && results !== null && results.length > 0 && (
              <AnimatePresence initial={false}>
                {results.map((word) => (
                  <WordItem
                    key={word.id ?? word.word}
                    word={word}
                    isExpanded={expandedId === (word.id ?? word.word)}
                    onToggle={() =>
                      handleToggleExpand(word.id ?? word.word)
                    }
                    onSpeak={onSpeak}
                    showChinese={showChineseTranslation}
                  />
                ))}
              </AnimatePresence>
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

VocabularyBrowserPanel.displayName = "VocabularyBrowserPanel";
