import { useState, useCallback, useRef, useEffect } from "react";
import type { VocabularyWord } from "../types/vocabulary";

export type LookupStatus = "loading" | "success" | "error";
export type LookupItemType = "word" | "translation";

export interface LookupItem {
  id: string;
  word: string;
  type: LookupItemType;
  status: LookupStatus;
  result?: string;
  error?: string;
  isNew?: boolean;
  emoji?: string;
  timestamp: number;
}

type LookupOrAddWord = (
  word: string,
  context?: {
    sourceContext?: string;
    sourcePdfName?: string;
    sourcePage?: number;
  },
  signal?: AbortSignal,
) => Promise<{
  success: boolean;
  existingWord?: VocabularyWord;
  isNew: boolean;
  message?: string;
}>;

type FormatDefinitions = (word: VocabularyWord) => string;

const MAX_CONCURRENT = 5;
const AUTO_DISMISS_MS = 30_000;

let nextId = 0;

export function useLookupQueue(
  lookupOrAddWord: LookupOrAddWord,
  formatDefinitionsForDisplay: FormatDefinitions,
) {
  const [lookups, setLookups] = useState<LookupItem[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    const controllers = controllersRef.current;
    const dismissTimers = dismissTimersRef.current;

    return () => {
      unmountedRef.current = true;
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
      for (const timer of dismissTimers.values()) {
        clearTimeout(timer);
      }
      dismissTimers.clear();
    };
  }, []);

  const activeCount = lookups.filter((l) => l.status === "loading").length;

  const scheduleDismiss = useCallback((id: string) => {
    const timer = setTimeout(() => {
      dismissTimersRef.current.delete(id);
      if (!unmountedRef.current) {
        setLookups((prev) => prev.filter((l) => l.id !== id));
      }
    }, AUTO_DISMISS_MS);
    dismissTimersRef.current.set(id, timer);
  }, []);

  /** Enqueue a new item and create its AbortController. */
  function enqueueItem(item: LookupItem): void {
    setLookups((prev) => [item, ...prev]);
    const controller = new AbortController();
    controllersRef.current.set(item.id, controller);
  }

  /**
   * Run an async task for a queued item, handling success/error/unmount uniformly.
   * The task should return partial updates on success, or null on failure.
   */
  const fireAsync = useCallback(
    (
      id: string,
      task: (signal: AbortSignal) => Promise<Partial<LookupItem> | null>,
      errorMessage: string,
    ): void => {
      const controller = controllersRef.current.get(id);
      if (!controller) return;

      const updateItem = (updates: Partial<LookupItem>) => {
        if (unmountedRef.current) return;
        setLookups((prev) =>
          prev.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        );
      };

      task(controller.signal)
        .then((updates) => {
          if (unmountedRef.current) return;
          controllersRef.current.delete(id);

          if (updates) {
            updateItem({ status: "success", ...updates });
            scheduleDismiss(id);
          } else {
            updateItem({ status: "error", error: errorMessage });
          }
        })
        .catch(() => {
          if (unmountedRef.current) return;
          controllersRef.current.delete(id);
          updateItem({ status: "error", error: errorMessage });
        });
    },
    [scheduleDismiss],
  );

  const validateEnqueue = useCallback(
    (type: LookupItemType, normalizedKey: string): "duplicate" | "max_reached" | undefined => {
      if (!normalizedKey) return undefined;

      const hasDuplicate = lookups.some(
        (l) => l.type === type && l.word.toLowerCase() === normalizedKey,
      );
      if (hasDuplicate) return "duplicate";
      if (activeCount >= MAX_CONCURRENT) return "max_reached";

      return undefined;
    },
    [lookups, activeCount],
  );

  const startLookup = useCallback(
    (
      word: string,
      context?: {
        sourceContext?: string;
        sourcePdfName?: string;
        sourcePage?: number;
      },
    ): "duplicate" | "max_reached" | undefined => {
      const normalizedWord = word.trim().toLowerCase();
      const blocked = validateEnqueue("word", normalizedWord);
      if (blocked) return blocked;

      const id = `lookup-${++nextId}`;
      const item: LookupItem = {
        id,
        word: word.trim(),
        type: "word",
        status: "loading",
        timestamp: Date.now(),
      };

      enqueueItem(item);

      fireAsync(
        id,
        (signal) =>
          lookupOrAddWord(word.trim(), context, signal).then((result) => {
            if (result.success && result.existingWord) {
              return {
                result: formatDefinitionsForDisplay(result.existingWord),
                isNew: result.isNew,
                emoji: result.existingWord?.emoji,
              };
            }
            return null;
          }),
        "Lookup failed",
      );

      return undefined;
    },
    [lookupOrAddWord, formatDefinitionsForDisplay, fireAsync, validateEnqueue],
  );

  const startTranslation = useCallback(
    (
      text: string,
      translateFn: (text: string, signal: AbortSignal) => Promise<string | null>,
    ): "duplicate" | "max_reached" | undefined => {
      const normalizedText = text.trim().toLowerCase();
      const blocked = validateEnqueue("translation", normalizedText);
      if (blocked) return blocked;

      const id = `translate-${++nextId}`;
      const item: LookupItem = {
        id,
        word: text.trim(),
        type: "translation",
        status: "loading",
        timestamp: Date.now(),
      };

      enqueueItem(item);

      fireAsync(
        id,
        (signal) =>
          translateFn(text.trim(), signal).then((result) =>
            result ? { result } : null,
          ),
        "翻譯失敗",
      );

      return undefined;
    },
    [fireAsync, validateEnqueue],
  );

  const dismissLookup = useCallback((id: string) => {
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
    setLookups((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    // Clear all dismiss timers
    for (const timer of dismissTimersRef.current.values()) {
      clearTimeout(timer);
    }
    dismissTimersRef.current.clear();
    setLookups((prev) => prev.filter((l) => l.status === "loading"));
  }, []);

  const cancelLookup = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(id);
    }
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
    setLookups((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return {
    lookups,
    activeCount,
    startLookup,
    startTranslation,
    dismissLookup,
    dismissAll,
    cancelLookup,
  };
}
