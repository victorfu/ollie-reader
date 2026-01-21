import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

export const Toast = ({
  message,
  type = "success",
  duration = 3000,
  onClose,
}: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

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

  const styles = typeConfig[type] ?? typeConfig.info;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="toast toast-top toast-center z-50 pointer-events-none"
    >
      <div
        className={`${styles.bg} ${styles.border} ${styles.text} border rounded-lg px-4 py-3 pointer-events-auto flex items-center gap-3 shadow-lg backdrop-blur-sm`}
      >
        <span className="text-sm font-medium">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-xs btn-circle opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200"
          aria-label="關閉"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
