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
    success: "alert-success",
    error: "alert-error",
    info: "alert-info",
  } as const;

  const alertClass = typeConfig[type] ?? typeConfig.info;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="toast toast-top toast-center z-50 pointer-events-none"
    >
      <div
        className={`alert ${alertClass} pointer-events-auto flex items-center gap-3 shadow-lg`}
      >
        <span className="text-sm font-medium">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-xs btn-circle opacity-80 transition-opacity hover:opacity-100"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
