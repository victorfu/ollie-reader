import { useEffect, useId, useRef } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "error" | "warning";
  isLoading?: boolean;
  errorMessage?: string | null;
  confirmDisabled?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "確認",
  cancelText = "取消",
  confirmVariant = "error",
  isLoading = false,
  errorMessage = null,
  confirmDisabled = false,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    if (isOpen) {
      if (!modal.open) modal.showModal();
    } else if (modal.open) {
      modal.close();
    }
  }, [isOpen]);

  const confirmButtonClass = {
    primary: "btn-primary",
    error: "btn-error",
    warning: "btn-warning",
  }[confirmVariant];

  return (
    <dialog
      ref={modalRef}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!isLoading) onCancel();
      }}
    >
      <div className="modal-box rounded-2xl border border-border-hairline shadow-floating">
        <h3 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h3>
        <p id={descriptionId} className="py-4 text-muted-foreground">
          {message}
        </p>
        {errorMessage ? (
          <p
            className="mb-2 rounded-[10px] bg-error/10 px-3 py-2 text-sm text-error"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost active:scale-[0.98]"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${confirmButtonClass} active:scale-[0.98]`}
            onClick={onConfirm}
            disabled={isLoading || confirmDisabled}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                處理中…
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onCancel} disabled={isLoading}>
          close
        </button>
      </form>
    </dialog>
  );
}
