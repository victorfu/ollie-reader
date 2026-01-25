import { useState, useCallback, useRef } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

export const useToastQueue = (maxVisible: number = 3) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounterRef = useRef(0);

  const addToast = useCallback(
    (message: string, type: ToastItem["type"], duration: number = 3000) => {
      const id = `toast-${++idCounterRef.current}`;
      const newToast: ToastItem = { id, message, type, duration };

      setToasts((prev) => {
        // Keep only the most recent (maxVisible - 1) toasts to make room for new one
        const limited = prev.slice(-(maxVisible - 1));
        return [...limited, newToast];
      });

      return id;
    },
    [maxVisible]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
  };
};
