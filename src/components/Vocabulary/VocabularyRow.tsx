import { motion } from "framer-motion";
import type { VocabularyWord } from "../../types/vocabulary";
import { SpeakerIcon, TrashIcon } from "../icons";
import { useSettings } from "../../hooks/useSettings";

interface VocabularyRowProps {
  word: VocabularyWord;
  isActive: boolean;
  onSelect: () => void;
  onPlay: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const difficultyDot: Record<string, string> = {
  easy: "bg-success",
  medium: "bg-warning",
  hard: "bg-error",
};

export const VocabularyRow = ({
  word,
  isActive,
  onSelect,
  onPlay,
  onDelete,
}: VocabularyRowProps) => {
  const { showChineseTranslation } = useSettings();
  const def = word.definitions[0];
  const previewDef = def
    ? showChineseTranslation && def.definitionChinese
      ? def.definitionChinese
      : def.definition || def.definitionChinese
    : "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`group flex items-stretch gap-1 rounded-lg pr-1 transition-colors ${
        isActive ? "bg-accent-tint" : "hover:bg-base-content/5"
      }`}
    >
      {/* Primary selector — the row's main click + keyboard target */}
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? "true" : undefined}
        className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          isActive ? "text-accent" : ""
        }`}
      >
        {word.emoji && (
          <span className="text-lg leading-6 shrink-0" role="img" aria-label={word.word}>
            {word.emoji}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {word.difficulty && (
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  difficultyDot[word.difficulty] ?? "bg-base-content/30"
                }`}
                title={word.difficulty}
              />
            )}
            <span className="truncate text-sm font-semibold tracking-tight">
              {word.word}
            </span>
            {word.phonetic && (
              <span className="truncate text-xs text-muted-foreground font-serif italic">
                {word.phonetic}
              </span>
            )}
          </span>
          {previewDef && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {def?.partOfSpeech ? (
                <span className="mr-1 uppercase tracking-wider text-[10px] text-muted-foreground/70">
                  {def.partOfSpeech}
                </span>
              ) : null}
              {previewDef}
            </span>
          )}
        </span>
      </button>

      {/* Action buttons — siblings of the selector, not descendants */}
      <span className="flex shrink-0 items-center self-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onPlay}
          className="btn btn-ghost btn-xs btn-circle text-accent/70 hover:text-accent"
          title="播放發音"
          aria-label="播放發音"
        >
          <SpeakerIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error"
          title="刪除單字"
          aria-label="刪除單字"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </span>
    </motion.div>
  );
};
