import { WordDetailPanel } from "./WordDetailPanel";
import type { VocabularyWord } from "../../types/vocabulary";

interface WordDetailProps {
  word: VocabularyWord;
  onClose: () => void;
  onUpdateWord: (
    wordId: string,
    updates: Partial<VocabularyWord>,
  ) => Promise<{ success: boolean; message?: string }>;
  onRegenerateWordDetails: (
    wordId: string,
    word: string,
  ) => Promise<{
    success: boolean;
    message?: string;
    updatedWord?: Partial<VocabularyWord>;
  }>;
  availableTags?: string[];
}

/** Mobile / fallback presentation: the word detail inside a modal sheet. */
export const WordDetail = ({
  word,
  onClose,
  onUpdateWord,
  onRegenerateWordDetails,
  availableTags = [],
}: WordDetailProps) => {
  return (
    <div className="modal modal-open modal-bottom sm:modal-middle">
      <div className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-hairline shadow-floating">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3 z-10"
          aria-label="關閉"
        >
          ✕
        </button>
        <WordDetailPanel
          key={word.id}
          word={word}
          onUpdateWord={onUpdateWord}
          onRegenerateWordDetails={onRegenerateWordDetails}
          availableTags={availableTags}
        />
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
