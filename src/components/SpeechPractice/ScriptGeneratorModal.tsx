import { useEffect, useRef } from "react";
import type { SpeechPracticeTopic } from "../../types/speechPractice";

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
  onUseScript: (script: string) => void;
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
  const modalRef = useRef<HTMLDialogElement>(null);

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
      if (e.key === "Escape" && isOpen && !isGenerating) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isGenerating, onClose]);

  const handleUseScript = () => {
    if (generatedScript.trim()) {
      onUseScript(generatedScript);
      onClose();
    }
  };

  return (
    <dialog ref={modalRef} className="modal modal-bottom sm:modal-middle">
      <div className="modal-box max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              ✨ AI 講稿生成器
            </h3>
            {topic && (
              <p className="text-sm text-base-content/60 mt-1">
                主題：{topic.titleChinese}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
            disabled={isGenerating}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Prompt Section */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>📝 生成指令（Prompt）</span>
              <span className="badge badge-ghost badge-sm">可編輯</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              placeholder="輸入生成講稿的指令..."
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={6}
              disabled={isGenerating}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-primary btn-sm gap-2"
                onClick={onGenerate}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    生成中...
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
                    重新生成
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
                    生成講稿
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
              <span>📄 講稿內容</span>
              <span className="badge badge-ghost badge-sm">可編輯</span>
            </label>
            {isGenerating ? (
              <div className="bg-base-200 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                <span className="loading loading-dots loading-lg text-primary" />
                <p className="text-base-content/60">AI 正在努力撰寫講稿...</p>
              </div>
            ) : (
              <textarea
                className="textarea textarea-bordered w-full text-sm leading-relaxed"
                placeholder="可直接輸入或編輯講稿內容，或使用上方 AI 生成..."
                value={generatedScript}
                onChange={(e) => onScriptChange(e.target.value)}
                rows={12}
              />
            )}
            {!isGenerating && (
              <p className="text-xs text-base-content/50">
                💡 提示：你可以直接編輯講稿，或使用 AI 生成後再修改
              </p>
            )}
          </div>
        </div>

        <div className="modal-action pt-4 border-t border-base-300 mt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isGenerating || isSaving}
          >
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary gap-2"
            onClick={handleUseScript}
            disabled={isSaving || isGenerating || !generatedScript.trim()}
          >
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                儲存中...
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
                儲存講稿
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal backdrop */}
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} disabled={isGenerating}>
          close
        </button>
      </form>
    </dialog>
  );
}
