import { motion } from "framer-motion";
import type { VocabularyWord } from "../../types/vocabulary";
import type { CefrInfo } from "../../types/wordPractice";
import { TrashIcon } from "../icons";
import { CefrBadge } from "../common/CefrBadge";
import { SpeakButton } from "../common/SpeakButton";
import {
  ROW_ACTIONS_CLASS,
  ROW_DELETE_CLASS,
  ROW_DELETE_ICON_CLASS,
} from "../common/rowActionStyles";
import { useSettings } from "../../hooks/useSettings";
import { useLanguage } from "../../hooks/useLanguage";

interface VocabularyRowProps {
  word: VocabularyWord;
  /** CEFR level of the word; no badge when null or omitted. */
  cefr?: CefrInfo | null;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const difficultyDot: Record<string, string> = {
  easy: "bg-success",
  medium: "bg-warning",
  hard: "bg-error",
};

export const VocabularyRow = ({
  word,
  cefr,
  isActive,
  onSelect,
  onDelete,
}: VocabularyRowProps) => {
  const { showChineseTranslation } = useSettings();
  const { t } = useLanguage();
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
        className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
            <span className="truncate text-base font-semibold tracking-tight">
              {word.word}
            </span>
            {cefr && <CefrBadge info={cefr} />}
          </span>
          {previewDef && (
            <span className="block truncate text-sm text-muted-foreground">
              {def?.partOfSpeech ? (
                <span className="mr-1 uppercase tracking-wider text-[11px] text-muted-foreground/70">
                  {def.partOfSpeech}
                </span>
              ) : null}
              {previewDef}
            </span>
          )}
        </span>
      </button>

      {/* Action buttons — siblings of the selector, not descendants.
          Always visible on touch screens; revealed on hover with a mouse. */}
      <span className={ROW_ACTIONS_CLASS}>
        <SpeakButton text={word.word} label={t("speak.play")} />
        <button
          type="button"
          onClick={onDelete}
          className={ROW_DELETE_CLASS}
          title={t("reader.vocab.deleteWordTitle")}
          aria-label={t("reader.vocab.deleteWordTitle")}
        >
          <TrashIcon className={ROW_DELETE_ICON_CLASS} />
        </button>
      </span>
    </motion.div>
  );
};
