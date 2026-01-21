import { useState, useCallback, useRef, useEffect } from "react";
import { isAbortError } from "../utils/errorUtils";

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export interface AsyncActions<T> {
  setData: (data: T | ((prev: T) => T)) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  execute: <R>(
    asyncFn: (signal: AbortSignal) => Promise<R>,
    options?: ExecuteOptions<R, T>,
  ) => Promise<R | undefined>;
}

interface ExecuteOptions<R, T> {
  onSuccess?: (result: R) => T | void;
  onError?: (error: Error) => string | void;
}

export function useAsyncState<T>(initialData: T): AsyncState<T> & AsyncActions<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const initialDataRef = useRef(initialData);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setData(initialDataRef.current);
    setLoading(false);
    setError(null);
  }, []);

  const execute = useCallback(
    async <R>(
      asyncFn: (signal: AbortSignal) => Promise<R>,
      options?: ExecuteOptions<R, T>,
    ): Promise<R | undefined> => {
      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const result = await asyncFn(controller.signal);

        // Don't update state if aborted
        if (controller.signal.aborted) return undefined;

        if (options?.onSuccess) {
          const newData = options.onSuccess(result);
          if (newData !== undefined) {
            setData(newData);
          }
        }

        setLoading(false);
        return result;
      } catch (err) {
        // Ignore abort errors
        if (isAbortError(err)) {
          return undefined;
        }

        const errorMessage =
          options?.onError?.(err instanceof Error ? err : new Error(String(err))) ??
          (err instanceof Error ? err.message : "發生未知錯誤");

        setError(errorMessage);
        setLoading(false);
        return undefined;
      }
    },
    [],
  );

  return {
    data,
    loading,
    error,
    setData,
    setLoading,
    setError,
    reset,
    execute,
  };
}

/**
 * Creates an AbortController that auto-aborts on unmount
 */
export function useAbortController(): () => AbortController {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current;
  }, []);
}
