import { useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  findExistingTranslation,
  addSentenceTranslation,
  getUserSentenceTranslations,
  deleteSentenceTranslation,
  deleteAllSentenceTranslations,
} from "../services/sentenceTranslationService";
import type {
  SentenceKeyWord,
  SentenceTranslation,
  SentenceTranslationFilters,
} from "../types/sentenceTranslation";
import { logger } from "../utils/logger";

export const useSentenceTranslation = () => {
  const { user } = useAuth();
  const [sentences, setSentences] = useState<SentenceTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

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

  // Find a previously saved translation without calling AI
  const findExistingSentence = useCallback(
    async (english: string): Promise<SentenceTranslation | null> => {
      if (!user) return null;

      const trimmedEnglish = english.trim();
      if (!trimmedEnglish) return null;

      try {
        return await findExistingTranslation(user.uid, trimmedEnglish);
      } catch (err) {
        logger.error("Failed to check existing translation:", err);
        return null;
      }
    },
    [user]
  );

  // Save a translation computed elsewhere (e.g. by smartLookup)
  const addTranslatedSentence = useCallback(
    async (
      english: string,
      chinese: string,
      keyWords?: SentenceKeyWord[]
    ): Promise<SentenceTranslation | null> => {
      if (!user) return null;

      const trimmedEnglish = english.trim();
      if (!trimmedEnglish || !chinese.trim()) return null;

      try {
        const sentence: Omit<SentenceTranslation, "id" | "createdAt"> = {
          userId: user.uid,
          english: trimmedEnglish,
          chinese,
          keyWords: keyWords?.length ? keyWords : undefined,
        };
        const id = await addSentenceTranslation(sentence);
        return { ...sentence, id, createdAt: new Date() };
      } catch (err) {
        logger.error("Failed to save translated sentence:", err);
        setError("儲存句子失敗");
        return null;
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
    findExistingSentence,
    addTranslatedSentence,
    deleteSentence,
    clearAll,
  };
};
