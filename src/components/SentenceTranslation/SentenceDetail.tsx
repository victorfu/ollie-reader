import {
  SentenceDetailPanel,
  type SentenceDetailPanelProps,
} from "./SentenceDetailPanel";

interface SentenceDetailProps extends SentenceDetailPanelProps {
  onClose: () => void;
}

/** Mobile / fallback presentation: the sentence detail inside a modal sheet. */
export const SentenceDetail = ({
  sentence,
  onAddKeyWord,
  onClose,
}: SentenceDetailProps) => {
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
        <SentenceDetailPanel
          key={sentence.id}
          sentence={sentence}
          onAddKeyWord={onAddKeyWord}
        />
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
