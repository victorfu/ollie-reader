import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LookupItem } from "../../hooks/useLookupQueue";
import { useFloatingPanel } from "../../hooks/useFloatingPanel";

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

const SpeakerIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const XIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface LookupPanelProps {
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (word: string) => void;
  hasStopButton?: boolean;
}

const LookupItemCard = memo(
  ({
    item,
    onDismiss,
    onSpeak,
  }: {
    item: LookupItem;
    onDismiss: (id: string) => void;
    onSpeak?: (word: string) => void;
  }) => {
    const borderColor =
      item.status === "loading"
        ? "border-l-accent"
        : item.status === "success"
          ? "border-l-success"
          : "border-l-error";

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 50, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`bg-base-100 rounded-lg border border-black/5 dark:border-white/10 p-3 shadow-sm border-l-4 ${borderColor}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.emoji && <span className="text-sm">{item.emoji}</span>}
            <span className="font-semibold text-sm truncate">{item.word}</span>
            {item.isNew && (
              <span className="badge badge-xs badge-accent">new</span>
            )}
            {onSpeak && (
              <button
                type="button"
                onClick={() => onSpeak(item.word)}
                className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
                aria-label="朗讀"
              >
                <SpeakerIcon />
              </button>
            )}
          </div>
          {item.status !== "loading" && (
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
              aria-label="關閉"
            >
              <XIcon />
            </button>
          )}
        </div>

        {item.status === "loading" && (
          <div className="mt-2 flex items-center gap-2">
            <span className="loading loading-spinner loading-xs text-accent" />
            <span className="text-xs text-base-content/50">查詢中...</span>
          </div>
        )}

        {item.status === "success" && item.result && (
          <p className="mt-2 text-xs leading-relaxed whitespace-pre-line text-base-content/70">
            {item.result}
          </p>
        )}

        {item.status === "error" && (
          <p className="mt-2 text-xs text-error">{item.error || "查詢失敗"}</p>
        )}
      </motion.div>
    );
  },
);

LookupItemCard.displayName = "LookupItemCard";

export const LookupPanel = memo(
  ({ lookups, onDismiss, onDismissAll, onSpeak, hasStopButton = false }: LookupPanelProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const { panelStyle, dragHandleProps, resizeHandleProps, isDragging } = useFloatingPanel({
      defaultSize: { width: 320, height: 384 },
      minSize: { width: 240, height: 200 },
      maxSize: { width: 600, height: 600 },
    });

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
          onClick={() => setCollapsed(false)}
          className={`fixed right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center bg-base-100/90 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-lg hover:scale-105 active:scale-[0.98] transition-all duration-200 ${hasStopButton ? "bottom-22" : "bottom-6"}`}
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
          className="bg-base-100/90 backdrop-blur-xl rounded-2xl border border-black/5 dark:border-white/10 shadow-xl flex flex-col"
        >
          {/* Header — draggable */}
          <div
            {...dragHandleProps}
            style={{ ...dragHandleProps.style, cursor: isDragging ? "grabbing" : "grab" }}
            className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/10 shrink-0"
          >
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-4 h-4 text-accent" />
              <span className="font-semibold text-sm">查詢結果</span>
              {activeCount > 0 && (
                <span className="badge badge-xs badge-accent">
                  {activeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
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
                onClick={() => setCollapsed(true)}
                className="btn btn-ghost btn-xs btn-circle hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="收合面板"
              >
                <MinusIcon />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            <AnimatePresence initial={false}>
              {lookups.map((item) => (
                <LookupItemCard
                  key={item.id}
                  item={item}
                  onDismiss={onDismiss}
                  onSpeak={onSpeak}
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
