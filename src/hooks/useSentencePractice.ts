import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "./useAuth";
import {
  addSentences,
  getUserSentences,
  updateSentence,
  deleteSentence as deleteSentenceService,
  clearAllSentences,
  updateSentenceOrders,
} from "../services/sentencePracticeService";
import {
  parseAndTranslateSentences,
  translateWithAI,
  getWordDefinition as getWordDefinitionAI,
} from "../services/aiService";
import type {
  PracticeSentence,
  SentencePracticeFilters,
} from "../types/sentencePractice";

export const useSentencePractice = () => {
  const { user } = useAuth();
  const [sentences, setSentences] = useState<PracticeSentence[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);

  // Cache for word definitions to avoid repeated API calls
  const wordDefinitionCache = useRef<Map<string, string>>(new Map());
  const loadRequestIdRef = useRef(0);

  // Load sentences from Firestore
  const loadSentences = useCallback(
    async (filters?: SentencePracticeFilters) => {
      if (!user) return;

      const requestId = ++loadRequestIdRef.current;

      setLoading(true);
      setError(null);

      try {
        const result = await getUserSentences(user.uid, filters);

        if (requestId !== loadRequestIdRef.current) return;

        setSentences(result.sentences);
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      } catch (err) {
        if (requestId !== loadRequestIdRef.current) return;
        console.error("Failed to load sentences:", err);
        setError("載入句子失敗");
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [user],
  );

  // Load more sentences (pagination)
  const loadMore = useCallback(async () => {
    if (!user || !hasMore || !lastDocId || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const result = await getUserSentences(user.uid, { cursor: lastDocId });
      setSentences((prev) => [...prev, ...result.sentences]);
      setHasMore(result.hasMore);
      setLastDocId(result.lastDocId);
    } catch (err) {
      console.error("Failed to load more sentences:", err);
      setError("載入更多句子失敗");
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, hasMore, lastDocId, isLoadingMore]);

  // Parse and translate text using AI service
  const parseAndTranslate = useCallback(
    async (
      text: string,
    ): Promise<{ success: boolean; message?: string; count?: number }> => {
      if (!user) {
        return { success: false, message: "使用者未登入" };
      }

      if (!text.trim()) {
        return { success: false, message: "請輸入英文文字" };
      }

      setIsProcessing(true);
      setError(null);

      try {
        const parsedSentences = await parseAndTranslateSentences(text);

        if (parsedSentences.length === 0) {
          return { success: false, message: "無法解析句子" };
        }

        // Save sentences to Firestore (order is auto-assigned in service layer)
        const sentencesToSave = parsedSentences.map((s) => ({
          english: s.english,
          chinese: s.chinese,
          userId: user.uid,
        }));

        const docIds = await addSentences(sentencesToSave);

        // Update local state with new sentences
        const currentLength = sentences.length;
        const newSentences: PracticeSentence[] = parsedSentences.map(
          (s, index) => ({
            id: docIds[index],
            english: s.english,
            chinese: s.chinese,
            userId: user.uid,
            order: currentLength + index, // Assign order based on current list length
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );

        setSentences((prev) => [...prev, ...newSentences]);

        // Check if any sentences have fallback translation (AI failed)
        const hasFailedTranslation = parsedSentences.some(
          (s) => s.chinese.includes("翻譯失敗")
        );

        return {
          success: true,
          message: hasFailedTranslation
            ? `已新增 ${parsedSentences.length} 個句子（翻譯暫時無法使用）`
            : `成功新增 ${parsedSentences.length} 個句子`,
          count: parsedSentences.length,
        };
      } catch (err) {
        console.error("Failed to parse and translate:", err);
        const message = err instanceof Error ? err.message : "處理失敗";
        setError(message);
        return { success: false, message };
      } finally {
        setIsProcessing(false);
      }
    },
    [user, sentences.length],
  );

  // Translate a single sentence (for editing)
  const translateSingle = useCallback(
    async (english: string): Promise<string | null> => {
      return translateWithAI(english);
    },
    [],
  );

  // Update a sentence (english and/or chinese)
  const editSentence = useCallback(
    async (
      sentenceId: string,
      newEnglish: string,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!user) {
        return { success: false, message: "使用者未登入" };
      }

      setIsProcessing(true);

      try {
        // Translate the new English sentence
        const newChinese = await translateSingle(newEnglish);

        if (!newChinese) {
          return { success: false, message: "翻譯失敗" };
        }

        // Update in Firestore
        await updateSentence(sentenceId, {
          english: newEnglish,
          chinese: newChinese,
        });

        // Update local state
        setSentences((prev) =>
          prev.map((s) =>
            s.id === sentenceId
              ? {
                  ...s,
                  english: newEnglish,
                  chinese: newChinese,
                  updatedAt: new Date(),
                }
              : s,
          ),
        );

        return { success: true, message: "更新成功" };
      } catch (err) {
        console.error("Failed to edit sentence:", err);
        const message = err instanceof Error ? err.message : "更新失敗";
        return { success: false, message };
      } finally {
        setIsProcessing(false);
      }
    },
    [user, translateSingle],
  );

  // Delete a sentence
  const deleteSentence = useCallback(
    async (
      sentenceId: string,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!user) {
        return { success: false, message: "使用者未登入" };
      }

      try {
        await deleteSentenceService(sentenceId);

        // Update local state
        setSentences((prev) => prev.filter((s) => s.id !== sentenceId));

        return { success: true, message: "刪除成功" };
      } catch (err) {
        console.error("Failed to delete sentence:", err);
        const message = err instanceof Error ? err.message : "刪除失敗";
        return { success: false, message };
      }
    },
    [user],
  );

  // Clear all sentences
  const clearAll = useCallback(async (): Promise<{
    success: boolean;
    message?: string;
  }> => {
    if (!user) {
      return { success: false, message: "使用者未登入" };
    }

    try {
      await clearAllSentences(user.uid);

      // Update local state
      setSentences([]);
      setHasMore(false);
      setLastDocId(undefined);

      return { success: true, message: "已清除所有句子" };
    } catch (err) {
      console.error("Failed to clear all sentences:", err);
      const message = err instanceof Error ? err.message : "清除失敗";
      return { success: false, message };
    }
  }, [user]);

  // Reorder sentences (for drag-and-drop)
  const reorderSentences = useCallback(
    async (
      reorderedList: PracticeSentence[],
    ): Promise<{ success: boolean; message?: string }> => {
      if (!user) {
        return { success: false, message: "使用者未登入" };
      }

      // Optimistic update - immediately update local state
      setSentences(reorderedList);

      try {
        // Prepare batch update with new order values
        const updates = reorderedList.map((sentence, index) => ({
          id: sentence.id!,
          order: index,
        }));

        await updateSentenceOrders(updates);

        return { success: true };
      } catch (err) {
        console.error("Failed to reorder sentences:", err);
        // Revert on error - reload from server
        await loadSentences();
        const message = err instanceof Error ? err.message : "排序失敗";
        setError(message);
        return { success: false, message };
      }
    },
    [user, loadSentences],
  );

  // Get word definition with caching
  const getWordDefinition = useCallback(
    async (word: string): Promise<string | null> => {
      const normalizedWord = word.toLowerCase().trim();

      // Check cache first
      if (wordDefinitionCache.current.has(normalizedWord)) {
        return wordDefinitionCache.current.get(normalizedWord) || null;
      }

      const definition = await getWordDefinitionAI(word);

      if (definition) {
        // Cache the result
        wordDefinitionCache.current.set(normalizedWord, definition);
      }

      return definition;
    },
    [],
  );

  // Load sentences on mount
  useEffect(() => {
    if (user) {
      loadSentences();
    }
  }, [user, loadSentences]);

  return {
    sentences,
    setSentences,
    loading,
    isLoadingMore,
    isProcessing,
    error,
    hasMore,
    loadSentences,
    loadMore,
    parseAndTranslate,
    translateSingle,
    editSentence,
    deleteSentence,
    clearAll,
    getWordDefinition,
    reorderSentences,
  };
};
