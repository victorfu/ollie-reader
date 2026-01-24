import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "./useAuth";
import { translateWithAI } from "../services/aiService";
import {
  findExistingTranslation,
  addSentenceTranslation,
  getUserSentenceTranslations,
  deleteSentenceTranslation,
  deleteAllSentenceTranslations,
} from "../services/sentenceTranslationService";
import type {
  SentenceTranslation,
  SentenceTranslationFilters,
} from "../types/sentenceTranslation";
import { isAbortError } from "../utils/errorUtils";
import { logger } from "../utils/logger";

export const useSentenceTranslation = () => {
  const { user } = useAuth();
  const [sentences, setSentences] = useState<SentenceTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load sentence translations
  const loadSentences = useCallback(
    async (filters?: SentenceTranslationFilters) => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await getUserSentenceTranslations(user.uid, filters);
        setSentences(result.sentences);
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      } catch (err) {
        logger.error("Failed to load sentence translations:", err);
        setError("載入失敗");
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Load more (pagination)
  const loadMore = useCallback(
    async (filters?: Omit<SentenceTranslationFilters, "cursor">) => {
      if (!user || !hasMore || !lastDocId) return;

      setIsLoading(true);

      try {
        const result = await getUserSentenceTranslations(user.uid, {
          ...filters,
          cursor: lastDocId,
        });

        setSentences((prev) => [...prev, ...result.sentences]);
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      } catch (err) {
        logger.error("Failed to load more sentences:", err);
        setError("載入更多失敗");
      } finally {
        setIsLoading(false);
      }
    },
    [user, hasMore, lastDocId]
  );

  // Translate text with Firestore caching
  const translateText = useCallback(
    async (
      english: string,
      sourcePdfName?: string
    ): Promise<{ chinese: string; fromCache: boolean } | null> => {
      if (!user) return null;

      const trimmedEnglish = english.trim();
      if (!trimmedEnglish) return null;

      // Abort previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Check cache first
        const existing = await findExistingTranslation(user.uid, trimmedEnglish);
        if (existing) {
          logger.info("Translation cache hit");
          return { chinese: existing.chinese, fromCache: true };
        }

        if (controller.signal.aborted) return null;

        // Call AI for translation
        const chinese = await translateWithAI(trimmedEnglish, controller.signal);

        if (controller.signal.aborted) return null;

        if (!chinese) {
          throw new Error("翻譯失敗");
        }

        // Save to Firestore
        await addSentenceTranslation({
          userId: user.uid,
          english: trimmedEnglish,
          chinese,
          sourcePdfName,
        });

        logger.info("Translation saved to cache");
        return { chinese, fromCache: false };
      } catch (err) {
        if (isAbortError(err)) return null;
        logger.error("Translation error:", err);
        throw err;
      }
    },
    [user]
  );

  // Delete a sentence
  const deleteSentence = useCallback(
    async (id: string) => {
      try {
        await deleteSentenceTranslation(id);
        setSentences((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        logger.error("Failed to delete sentence:", err);
        setError("刪除失敗");
      }
    },
    []
  );

  // Clear all sentences
  const clearAll = useCallback(async () => {
    if (!user) return;

    try {
      await deleteAllSentenceTranslations(user.uid);
      setSentences([]);
      setHasMore(false);
      setLastDocId(undefined);
    } catch (err) {
      logger.error("Failed to clear all sentences:", err);
      setError("清除失敗");
    }
  }, [user]);

  return {
    sentences,
    isLoading,
    hasMore,
    error,
    loadSentences,
    loadMore,
    translateText,
    deleteSentence,
    clearAll,
  };
};
