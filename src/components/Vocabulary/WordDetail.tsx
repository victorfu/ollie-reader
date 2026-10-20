import { X } from "lucide-react";
import { WordDetailPanel, type WordDetailPanelProps } from "./WordDetailPanel";

interface WordDetailProps extends WordDetailPanelProps {
  onClose: () => void;
}

/** Mobile / fallback presentation: the word detail inside a modal sheet. */
export const WordDetail = ({
  word,
  onClose,
  onUpdateWord,
  onRegenerateWordDetails,
  availableTags = [],
  cefr,
}: WordDetailProps) => {
  return (
    <div className="modal modal-open modal-bottom sm:modal-middle">
      <div className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-hairline shadow-floating">
        <WordDetailPanel
          key={word.id}
          word={word}
          onUpdateWord={onUpdateWord}
          onRegenerateWordDetails={onRegenerateWordDetails}
          availableTags={availableTags}
          cefr={cefr}
          headerAction={
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-circle size-11 min-h-11 shrink-0 p-0"
              aria-label="關閉"
            >
              <X className="size-6 shrink-0" aria-hidden="true" />
            </button>
          }
        />
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
