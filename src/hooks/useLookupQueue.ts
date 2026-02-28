import { useState, useCallback, useRef, useEffect } from "react";
import type { VocabularyWord } from "../types/vocabulary";
import { isAbortError } from "../utils/errorUtils";
import { logger } from "../utils/logger";

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
const MAX_VISIBLE_ITEMS = 20;

let nextId = 0;

function clampLookupItems(items: LookupItem[]): LookupItem[] {
  if (items.length <= MAX_VISIBLE_ITEMS) return items;

  const next = [...items];
  while (next.length > MAX_VISIBLE_ITEMS) {
    let removeIndex = -1;
    for (let i = next.length - 1; i >= 0; i -= 1) {
      if (next[i].status !== "loading") {
        removeIndex = i;
        break;
      }
    }

    // Fallback: if all items are loading, remove the oldest item.
    if (removeIndex === -1) {
      removeIndex = next.length - 1;
    }
    next.splice(removeIndex, 1);
  }

  return next;
}

export function useLookupQueue(
  lookupOrAddWord: LookupOrAddWord,
  formatDefinitionsForDisplay: FormatDefinitions,
) {
  const [lookups, setLookups] = useState<LookupItem[]>([]);
  const [requestSignal, setRequestSignal] = useState(0);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    const controllers = controllersRef.current;

    return () => {
      unmountedRef.current = true;
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  const activeCount = lookups.filter((l) => l.status === "loading").length;

  /** Enqueue a new item and create its AbortController. */
  function enqueueItem(item: LookupItem): void {
    setLookups((prev) => clampLookupItems([item, ...prev]));
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
          } else if (controller.signal.aborted) {
            // Aborted (user cancelled) — remove silently
            setLookups((prev) => prev.filter((l) => l.id !== id));
          } else {
            updateItem({ status: "error", error: errorMessage });
          }
        })
        .catch((err: unknown) => {
          if (unmountedRef.current) return;
          controllersRef.current.delete(id);

          if (isAbortError(err)) {
            setLookups((prev) => prev.filter((l) => l.id !== id));
            return;
          }

          logger.error("Lookup/translation failed:", err);
          updateItem({ status: "error", error: errorMessage });
        });
    },
    [],
  );

  const signalRequest = useCallback(() => {
    setRequestSignal((prev) => prev + 1);
  }, []);

  const validateEnqueue = useCallback(
    (type: LookupItemType, normalizedKey: string): "duplicate" | "max_reached" | undefined => {
      if (!normalizedKey) return undefined;

      const hasDuplicate = lookups.some(
        (l) =>
          l.type === type &&
          l.status === "loading" &&
          l.word.toLowerCase() === normalizedKey,
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
      signalRequest();
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
    [
      lookupOrAddWord,
      formatDefinitionsForDisplay,
      fireAsync,
      signalRequest,
      validateEnqueue,
    ],
  );

  const startTranslation = useCallback(
    (
      text: string,
      translateFn: (text: string, signal: AbortSignal) => Promise<string | null>,
    ): "duplicate" | "max_reached" | undefined => {
      signalRequest();
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
    [fireAsync, signalRequest, validateEnqueue],
  );

  const dismissLookup = useCallback((id: string) => {
    setLookups((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setLookups((prev) => prev.filter((l) => l.status === "loading"));
  }, []);

  const cancelLookup = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(id);
    }
    setLookups((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return {
    lookups,
    activeCount,
    requestSignal,
    startLookup,
    startTranslation,
    dismissLookup,
    dismissAll,
    cancelLookup,
  };
}
