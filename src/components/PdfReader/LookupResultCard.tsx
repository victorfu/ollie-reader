import { memo } from "react";
import { motion } from "framer-motion";
import type { LookupItem } from "../../hooks/useLookupQueue";

const SpeakerIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const TranslateIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
  </svg>
);

const XIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * A single result card in the lookup queue — a dictionary lookup or a sentence
 * translation, with loading / success / error states. Shared by the subtitles
 * LookupPanel and the PDF reader's unified WordPanel.
 */
export const LookupResultCard = memo(
  ({
    item,
    onDismiss,
    onSpeak,
    showChinese,
    disableLayoutAnimation = false,
  }: {
    item: LookupItem;
    onDismiss: (id: string) => void;
    onSpeak?: (word: string) => void;
    showChinese: boolean;
    disableLayoutAnimation?: boolean;
  }) => {
    const isTranslation = item.type === "translation";
    const borderColor =
      item.status === "loading"
        ? "border-l-accent"
        : item.status === "success"
          ? "border-l-success"
          : "border-l-error";

    return (
      <motion.div
        layout={disableLayoutAnimation ? false : "position"}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 50, scale: 0.95 }}
        transition={
          disableLayoutAnimation
            ? { duration: 0.2 }
            : { duration: 0.2, layout: { duration: 0.14, ease: "easeOut" } }
        }
        className={`bg-base-100 rounded-lg border border-border-hairline p-3 shadow-soft border-l-4 ${borderColor}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isTranslation ? (
              <TranslateIcon className="w-3.5 h-3.5 text-base-content/50 shrink-0" />
            ) : (
              item.emoji && <span className="text-sm">{item.emoji}</span>
            )}
            <span className={`font-semibold text-lg ${isTranslation ? "line-clamp-2" : "truncate"}`}>
              {item.word}
            </span>
            {!isTranslation && item.isNew && (
              <span className="badge badge-xs badge-accent">new</span>
            )}
            {isTranslation && (
              <span className="badge badge-xs badge-ghost shrink-0">翻譯</span>
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
            <span className="text-sm text-base-content/50">
              {isTranslation ? "翻譯中..." : "查詢中..."}
            </span>
          </div>
        )}

        {item.status === "success" && (
          <>
            {/* Word lookup with structured definitions */}
            {!isTranslation && item.vocabularyWord && item.vocabularyWord.definitions.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {item.vocabularyWord.phonetic && (
                  <p className="text-sm text-base-content/40 italic">
                    {item.vocabularyWord.phonetic}
                  </p>
                )}
                {item.vocabularyWord.definitions.map((def, i) => (
                  <div key={i} className="text-base leading-relaxed">
                    {def.partOfSpeech && (
                      <span className="text-accent font-medium italic mr-1.5">
                        {def.partOfSpeech}.
                      </span>
                    )}
                    <span className="text-base-content/80">
                      {def.definition || def.definitionChinese}
                    </span>
                    {showChinese && def.definitionChinese && def.definition && (
                      <p className="text-base-content/50 text-sm mt-0.5 pl-1">
                        {def.definitionChinese}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Translation type or words without structured data */
              item.result && (
                <p className="mt-2 text-base leading-relaxed whitespace-pre-line text-base-content/70">
                  {item.result}
                </p>
              )
            )}
          </>
        )}

        {item.status === "error" && (
          <p className="mt-2 text-sm text-error">
            {item.error || (isTranslation ? "翻譯失敗" : "查詢失敗")}
          </p>
        )}
      </motion.div>
    );
  },
);

LookupResultCard.displayName = "LookupResultCard";
