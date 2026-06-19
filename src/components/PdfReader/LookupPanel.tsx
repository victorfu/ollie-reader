import { memo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LookupItem } from "../../hooks/useLookupQueue";
import { useFloatingPanel } from "../../hooks/useFloatingPanel";
import { useSettings } from "../../hooks/useSettings";
import { Search } from "lucide-react";
import { LookupResultCard } from "./LookupResultCard";

const BookOpenIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const MinusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14" />
  </svg>
);

interface LookupPanelProps {
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (word: string) => void;
  onLookupWord?: (word: string) => void;
  showSignal?: number;
}

export const LookupPanel = memo(
  ({ lookups, onDismiss, onDismissAll, onSpeak, onLookupWord, showSignal }: LookupPanelProps) => {
    const [collapsedToken, setCollapsedToken] = useState<number | "nosignal" | null>(
      null,
    );
    const [searchInput, setSearchInput] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const { showChineseTranslation, updateShowChineseTranslation } = useSettings();
    const { panelStyle, dragHandleProps, resizeHandleProps, isDragging, isResizing } =
      useFloatingPanel({
        defaultSize: { width: 320, height: 520 },
        minSize: { width: 240, height: 200 },
        maxSize: { width: 600, height: 760 },
      });
    const disableItemLayoutAnimation = isDragging || isResizing;
    const signalToken = showSignal ?? "nosignal";
    const collapsed = collapsedToken !== null && collapsedToken === signalToken;

    const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const word = searchInput.trim();
      if (!word || !onLookupWord) return;
      onLookupWord(word);
      setSearchInput("");
      searchInputRef.current?.focus();
    };

    if (lookups.length === 0) return null;

    const activeCount = lookups.filter((l) => l.status === "loading").length;
    const hasCompleted = lookups.some((l) => l.status !== "loading");

    // Collapsed: small floating button
    if (collapsed) {
      return (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={() => setCollapsedToken(null)}
          className="fixed right-6 bottom-6 z-40 w-14 h-14 rounded-full flex items-center justify-center bg-base-100/90 backdrop-blur-xl border border-border-hairline shadow-floating hover:scale-105 hover:text-accent active:scale-[0.98] transition-all duration-200"
          aria-label="展開查詢面板"
        >
          <div className="relative">
            <BookOpenIcon className="w-5 h-5" />
            {lookups.length > 0 && (
              <span className="absolute -top-2 -right-2 badge badge-xs badge-accent">
                {lookups.length}
              </span>
            )}
          </div>
        </motion.button>
      );
    }

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
            style={{ ...dragHandleProps.style, cursor: isDragging ? "grabbing" : "grab" }}
            className="flex items-center justify-between px-4 py-3 border-b border-border-hairline shrink-0"
          >
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-4 h-4 text-accent" />
              <span className="font-semibold text-base">查詢結果</span>
              {activeCount > 0 && (
                <span className="badge badge-xs badge-accent">
                  {activeCount}
                </span>
              )}
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
                onClick={() => setCollapsedToken(signalToken)}
                className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="收合面板"
              >
                <MinusIcon />
              </button>
            </div>
          </div>

          {/* Search row — type a word to look it up directly */}
          {onLookupWord && (
            <div className="px-3 py-2 border-b border-border-hairline shrink-0">
              <form
                onSubmit={handleSearchSubmit}
                onPointerDown={(e) => e.stopPropagation()}
                className="relative flex items-center"
              >
                <Search
                  className="w-4 h-4 text-base-content/40 absolute left-2.5 pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="輸入單字查詢…"
                  aria-label="輸入單字查詢"
                  className="w-full rounded-[6px] border border-border-hairline bg-base-200/50 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-base-content/40"
                />
              </form>
            </div>
          )}

          {/* Items */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            <AnimatePresence initial={false}>
              {lookups.map((item) => (
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
          </div>

          {/* Resize handle */}
          <div
            {...resizeHandleProps}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          >
            <svg className="w-3 h-3 text-base-content/20 absolute bottom-0.5 right-0.5" viewBox="0 0 6 6">
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

LookupPanel.displayName = "LookupPanel";
