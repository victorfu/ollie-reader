import { motion } from "framer-motion";
import { Languages } from "lucide-react";
import type { SentenceTranslation } from "../../types/sentenceTranslation";
import { TrashIcon } from "../icons";
import { SpeakButton } from "../common/SpeakButton";
import {
  ROW_ACTIONS_CLASS,
  ROW_DELETE_CLASS,
  ROW_DELETE_ICON_CLASS,
} from "../common/rowActionStyles";

interface SentenceRowProps {
  sentence: SentenceTranslation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

/** Compact feed row for a translated sentence, visually aligned with VocabularyRow. */
export const SentenceRow = ({
  sentence,
  isActive,
  onSelect,
  onDelete,
}: SentenceRowProps) => {
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
        <Languages
          className="mt-1 size-4 shrink-0 text-accent/70"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tracking-tight">
            {sentence.english}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {sentence.chinese}
          </span>
        </span>
      </button>

      {/* Action buttons — siblings of the selector, not descendants.
          Always visible on touch screens; revealed on hover with a mouse. */}
      <span className={ROW_ACTIONS_CLASS}>
        <SpeakButton text={sentence.english} label="朗讀句子" />
        <button
          type="button"
          onClick={onDelete}
          className={ROW_DELETE_CLASS}
          title="刪除句子"
          aria-label="刪除句子"
        >
          <TrashIcon className={ROW_DELETE_ICON_CLASS} />
        </button>
      </span>
    </motion.div>
  );
};
