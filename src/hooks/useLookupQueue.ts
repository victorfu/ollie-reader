import { useState, useCallback, useRef, useEffect } from "react";
import type { VocabularyWord } from "../types/vocabulary";

export type LookupStatus = "loading" | "success" | "error";

export interface LookupItem {
  id: string;
  word: string;
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

export const useLookupQueue = (
  lookupOrAddWord: LookupOrAddWord,
  formatDefinitionsForDisplay: FormatDefinitions,
) => {
  const [lookups, setLookups] = useState<LookupItem[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const unmountedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      for (const controller of controllersRef.current.values()) {
        controller.abort();
      }
      controllersRef.current.clear();
      for (const timer of dismissTimersRef.current.values()) {
        clearTimeout(timer);
      }
      dismissTimersRef.current.clear();
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
      if (!normalizedWord) return undefined;

      // Check for duplicate (same word already in queue)
      const hasDuplicate = lookups.some(
        (l) => l.word.toLowerCase() === normalizedWord,
      );
      if (hasDuplicate) return "duplicate";

      // Check concurrent limit
      if (activeCount >= MAX_CONCURRENT) return "max_reached";

      const id = `lookup-${++nextId}`;
      const item: LookupItem = {
        id,
        word: word.trim(),
        status: "loading",
        timestamp: Date.now(),
      };

      setLookups((prev) => [item, ...prev]);

      // Create abort controller for this lookup
      const controller = new AbortController();
      controllersRef.current.set(id, controller);

      // Fire async lookup
      lookupOrAddWord(word.trim(), context, controller.signal)
        .then((result) => {
          if (unmountedRef.current) return;
          controllersRef.current.delete(id);

          if (result.success && result.existingWord) {
            const formatted = formatDefinitionsForDisplay(result.existingWord);
            setLookups((prev) =>
              prev.map((l) =>
                l.id === id
                  ? {
                      ...l,
                      status: "success" as const,
                      result: formatted,
                      isNew: result.isNew,
                      emoji: result.existingWord?.emoji,
                    }
                  : l,
              ),
            );
            scheduleDismiss(id);
          } else {
            setLookups((prev) =>
              prev.map((l) =>
                l.id === id
                  ? {
                      ...l,
                      status: "error" as const,
                      error: result.message || "Lookup failed",
                    }
                  : l,
              ),
            );
          }
        })
        .catch(() => {
          if (unmountedRef.current) return;
          controllersRef.current.delete(id);
          setLookups((prev) =>
            prev.map((l) =>
              l.id === id
                ? { ...l, status: "error" as const, error: "Lookup failed" }
                : l,
            ),
          );
        });

      return undefined;
    },
    [lookups, activeCount, lookupOrAddWord, formatDefinitionsForDisplay, scheduleDismiss],
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
    dismissLookup,
    dismissAll,
    cancelLookup,
  };
};
