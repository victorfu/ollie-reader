import { useEffect } from "react";
import type { ToastItem } from "../../hooks/useToastQueue";

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast toast-top toast-center z-50 pointer-events-none flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItemComponent key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

const ToastItemComponent = ({ toast, onRemove }: ToastItemProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration ?? 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const typeConfig = {
    success: {
      bg: "bg-success/10",
      border: "border-success/20",
      text: "text-success",
    },
    error: {
      bg: "bg-error/10",
      border: "border-error/20",
      text: "text-error",
    },
    info: {
      bg: "bg-info/10",
      border: "border-info/20",
      text: "text-info",
    },
  } as const;

  const styles = typeConfig[toast.type] ?? typeConfig.info;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`${styles.bg} ${styles.border} ${styles.text} border rounded-lg px-4 py-3 pointer-events-auto flex items-center gap-3 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200`}
    >
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="btn btn-ghost btn-xs btn-circle opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200"
        aria-label="關閉"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};
