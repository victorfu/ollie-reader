import { useEffect, useRef } from "react";
import type { SpeechPracticeTopic } from "../../types/speechPractice";
import { T } from "../common/T";
import { useLanguage } from "../../hooks/useLanguage";

interface ScriptGeneratorModalProps {
  isOpen: boolean;
  topic: SpeechPracticeTopic | null;
  prompt: string;
  generatedScript: string;
  isGenerating: boolean;
  error: string | null;
  isSaving?: boolean;
  onPromptChange: (prompt: string) => void;
  onScriptChange: (script: string) => void;
  onGenerate: () => void;
  onUseScript: (script: string) => Promise<boolean>;
  onClose: () => void;
}

export function ScriptGeneratorModal({
  isOpen,
  topic,
  prompt,
  generatedScript,
  isGenerating,
  error,
  isSaving = false,
  onPromptChange,
  onScriptChange,
  onGenerate,
  onUseScript,
  onClose,
}: ScriptGeneratorModalProps) {
  const { t } = useLanguage();
  const modalRef = useRef<HTMLDialogElement>(null);
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    if (isOpen) {
      modal.showModal();
    } else {
      modal.close();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isOpen) return;
      e.preventDefault();
      if (!isGenerating && !isSaving) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isGenerating, isSaving, onClose]);

  const handleUseScript = async () => {
    if (
      generatedScript.trim() &&
      !isSaving &&
      !submissionInFlightRef.current
    ) {
      submissionInFlightRef.current = true;
      try {
        const saved = await onUseScript(generatedScript);
        if (!saved) return;
        onClose();
      } finally {
        submissionInFlightRef.current = false;
      }
    }
  };

  return (
    <dialog
      ref={modalRef}
      className="modal modal-bottom sm:modal-middle"
      onCancel={(event) => {
        event.preventDefault();
        if (!isGenerating && !isSaving) onClose();
      }}
    >
      <div className="modal-box max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-border-hairline shadow-floating">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              ✨ <T k="listening.script.title" variant="stacked" />
            </h3>
            {topic && (
              <p className="text-sm text-muted-foreground mt-1">
                <T k="listening.script.topic" params={{ topic: topic.titleChinese }} />
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
            disabled={isGenerating || isSaving}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Prompt Section */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>
                📝 <T k="listening.script.promptLabel" />
              </span>
              <span className="badge badge-ghost badge-sm">
                <T k="listening.script.editable" />
              </span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              placeholder={t("listening.script.promptPlaceholder")}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={6}
              disabled={isGenerating || isSaving}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-primary btn-sm gap-2 active:scale-[0.98]"
                onClick={onGenerate}
                disabled={isGenerating || isSaving || !prompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    <T k="listening.script.generating" variant="stacked" />
                  </>
                ) : generatedScript ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 4v6h6" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    <T k="listening.script.regenerate" variant="stacked" />
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <T k="listening.script.generate" variant="stacked" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Script Section - Always visible for direct editing */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>
                📄 <T k="listening.script.contentLabel" />
              </span>
              <span className="badge badge-ghost badge-sm">
                <T k="listening.script.editable" />
              </span>
            </label>
            {isGenerating ? (
              <div className="bg-base-200 rounded-xl border border-border-hairline p-8 flex flex-col items-center justify-center gap-3">
                <span className="loading loading-dots loading-lg text-primary" />
                <p className="text-muted-foreground">
                  <T k="listening.script.writing" />
                </p>
              </div>
            ) : (
              <textarea
                className="textarea textarea-bordered w-full text-sm leading-relaxed"
                placeholder={t("listening.script.contentPlaceholder")}
                value={generatedScript}
                onChange={(e) => onScriptChange(e.target.value)}
                rows={12}
                disabled={isSaving}
              />
            )}
            {!isGenerating && (
              <p className="text-xs text-muted-foreground">
                💡 <T k="listening.script.tip" />
              </p>
            )}
          </div>
        </div>

        <div className="modal-action pt-4 border-t border-border-hairline mt-4">
          <button
            type="button"
            className="btn btn-ghost active:scale-[0.98]"
            onClick={onClose}
            disabled={isGenerating || isSaving}
          >
            <T k="common.cancel" variant="stacked" />
          </button>
          <button
            type="button"
            className="btn btn-primary gap-2 active:scale-[0.98]"
            onClick={() => void handleUseScript()}
            disabled={isSaving || isGenerating || !generatedScript.trim()}
          >
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                <T k="listening.saving" variant="stacked" />
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <T k="listening.script.save" variant="stacked" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal backdrop */}
      <form method="dialog" className="modal-backdrop">
        <button
          type="button"
          onClick={onClose}
          disabled={isGenerating || isSaving}
        >
          close
        </button>
      </form>
    </dialog>
  );
}
