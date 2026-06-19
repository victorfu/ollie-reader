import { useEffect, useRef } from "react";

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
}: ConfirmModalProps) {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  const confirmButtonClass = {
    primary: "btn-primary",
    error: "btn-error",
    warning: "btn-warning",
  }[confirmVariant];

  return (
    <dialog ref={modalRef} className="modal modal-bottom sm:modal-middle">
      <div className="modal-box rounded-2xl border border-border-hairline shadow-floating">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="py-4 text-muted-foreground">{message}</p>
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
            disabled={isLoading}
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
