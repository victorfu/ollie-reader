import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import {
  findExistingTranslation,
  addSentenceTranslation,
  getUserSentenceTranslations,
  deleteSentenceTranslation,
  deleteAllSentenceTranslations,
  listUserSentenceTranslations,
} from "../services/sentenceTranslationService";
import { filterSentenceTranslations } from "../utils/sentenceSearch";
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
  const loadRequestIdRef = useRef(0);
  const activeUidRef = useRef(user?.uid);
  // The whole book, downloaded once per user for searching. Adds and deletes
  // patch the copy so a search never has to download the book again.
  const searchCacheRef = useRef<{
    uid: string;
    sentences: Promise<SentenceTranslation[]>;
  } | null>(null);

  const patchSearchCache = useCallback(
    (
      uid: string,
      update: (sentences: SentenceTranslation[]) => SentenceTranslation[],
    ) => {
      const cache = searchCacheRef.current;
      if (!cache || cache.uid !== uid) return;
      cache.sentences = cache.sentences.then(update);
    },
    [],
  );

  useEffect(() => {
    activeUidRef.current = user?.uid;
    loadRequestIdRef.current += 1;
    searchCacheRef.current = null;
    setSentences([]);
    setHasMore(false);
    setLastDocId(undefined);
    setIsLoading(false);
    setError(null);
  }, [user?.uid]);

  // Load sentence translations
  const loadSentences = useCallback(
    async (filters?: SentenceTranslationFilters) => {
      if (!user) return;

      const uid = user.uid;
      const requestId = ++loadRequestIdRef.current;

      setIsLoading(true);
      setError(null);

      try {
        const result = await getUserSentenceTranslations(uid, filters);
        if (
          requestId !== loadRequestIdRef.current ||
          activeUidRef.current !== uid
        ) {
          return;
        }
        setSentences(result.sentences);
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      } catch (err) {
        if (
          requestId !== loadRequestIdRef.current ||
          activeUidRef.current !== uid
        ) {
          return;
        }
        logger.error("Failed to load sentence translations:", err);
        setError("載入失敗");
      } finally {
        if (
          requestId === loadRequestIdRef.current &&
          activeUidRef.current === uid
        ) {
          setIsLoading(false);
        }
      }
    },
    [user]
  );

  // Load more (pagination)
  const loadMore = useCallback(
    async (filters?: Omit<SentenceTranslationFilters, "cursor">) => {
      if (!user || !hasMore || !lastDocId) return;

      const uid = user.uid;
      const requestId = loadRequestIdRef.current;
      const cursor = lastDocId;

      setIsLoading(true);

      try {
        const result = await getUserSentenceTranslations(uid, {
          ...filters,
          cursor,
        });

        if (
          requestId !== loadRequestIdRef.current ||
          activeUidRef.current !== uid
        ) {
          return;
        }

        setSentences((prev) => {
          const existingIds = new Set(prev.map((sentence) => sentence.id));
          return [
            ...prev,
            ...result.sentences.filter(
              (sentence) => !existingIds.has(sentence.id),
            ),
          ];
        });
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      } catch (err) {
        if (
          requestId !== loadRequestIdRef.current ||
          activeUidRef.current !== uid
        ) {
          return;
        }
        logger.error("Failed to load more sentences:", err);
        setError("載入更多失敗");
      } finally {
        if (
          requestId === loadRequestIdRef.current &&
          activeUidRef.current === uid
        ) {
          setIsLoading(false);
        }
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
      const uid = user.uid;

      try {
        const existing = await findExistingTranslation(uid, trimmedEnglish);
        return activeUidRef.current === uid ? existing : null;
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
        const added = await addSentenceTranslation(sentence);
        if (activeUidRef.current !== user.uid) return null;
        if (!added.created && added.sentence) return added.sentence;
        const created = { ...sentence, id: added.id, createdAt: new Date() };
        patchSearchCache(user.uid, (cached) => [created, ...cached]);
        return created;
      } catch (err) {
        logger.error("Failed to save translated sentence:", err);
        setError("儲存句子失敗");
        return null;
      }
    },
    [user, patchSearchCache]
  );

  // Delete a sentence
  const deleteSentence = useCallback(
    async (id: string): Promise<{ success: boolean; message?: string }> => {
      const uid = activeUidRef.current;
      if (!uid) return { success: false, message: "尚未登入" };

      try {
        await deleteSentenceTranslation(id);
        if (activeUidRef.current !== uid) {
          return { success: false, message: "帳號已切換" };
        }
        setSentences((prev) => prev.filter((s) => s.id !== id));
        patchSearchCache(uid, (cached) => cached.filter((s) => s.id !== id));
        return { success: true };
      } catch (err) {
        if (activeUidRef.current !== uid) {
          return { success: false, message: "帳號已切換" };
        }
        logger.error("Failed to delete sentence:", err);
        setError("刪除失敗");
        return { success: false, message: "刪除失敗" };
      }
    },
    [patchSearchCache]
  );

  // Clear all sentences
  const clearAll = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;

    try {
      await deleteAllSentenceTranslations(uid);
      if (activeUidRef.current !== uid) return;
      setSentences([]);
      patchSearchCache(uid, () => []);
      setHasMore(false);
      setLastDocId(undefined);
    } catch (err) {
      if (activeUidRef.current !== uid) return;
      logger.error("Failed to clear all sentences:", err);
      setError("清除失敗");
    }
  }, [user, patchSearchCache]);

  const searchSentences = useCallback(
    async (searchText: string): Promise<SentenceTranslation[]> => {
      if (!user) return [];
      const uid = user.uid;
      if (!searchText.trim()) return [];
      let cache = searchCacheRef.current;
      if (!cache || cache.uid !== uid) {
        cache = { uid, sentences: listUserSentenceTranslations(uid) };
        searchCacheRef.current = cache;
      }
      try {
        const all = await cache.sentences;
        if (activeUidRef.current !== uid) return [];
        return filterSentenceTranslations(all, searchText);
      } catch (err) {
        // Forget the failed download so the next search can retry.
        if (searchCacheRef.current === cache) searchCacheRef.current = null;
        logger.error("Failed to search sentence translations:", err);
        return [];
      }
    },
    [user],
  );

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
    searchSentences,
  };
};
