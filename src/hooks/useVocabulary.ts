import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "./useAuth";
import {
  addVocabularyWord,
  getUserVocabulary,
  getVocabularyWord,
  updateVocabularyWord,
  deleteVocabularyWord,
  checkWordExists,
  getUserTags,
  getVocabularyForReview,
  updateReviewStats,
  searchUserVocabulary,
} from "../services/vocabularyService";
import { generateWordDetails } from "../services/aiService";
import { isAbortError } from "../utils/errorUtils";
import type {
  VocabularyWord,
  VocabularyFilters,
  ReviewMode,
  Definition,
} from "../types/vocabulary";

// Helper to format definitions for display
export const formatDefinitionsForDisplay = (
  word: VocabularyWord,
): string => {
  if (!word.definitions || word.definitions.length === 0) {
    return "";
  }

  const lines: string[] = [];

  // Add emoji and phonetic if available
  const header = [word.emoji, word.phonetic].filter(Boolean).join(" ");
  if (header) {
    lines.push(header);
  }

  // Add definitions
  word.definitions.forEach((def: Definition, index: number) => {
    const partOfSpeech = def.partOfSpeech ? `(${def.partOfSpeech}) ` : "";
    const chineseDef = def.definitionChinese || def.definition || "";
    lines.push(`${index + 1}. ${partOfSpeech}${chineseDef}`);
  });

  return lines.join("\n");
};

export const useVocabulary = () => {
  const { user } = useAuth();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentFiltersRef = useRef<VocabularyFilters | undefined>(undefined);
  const loadRequestIdRef = useRef(0);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Add a word to vocabulary
  const addWord = useCallback(
    async (
      word: string,
      context?: {
        sourceContext?: string;
        sourcePdfName?: string;
        sourcePage?: number;
      },
    ): Promise<{ success: boolean; wordId?: string; message?: string }> => {
      if (!user) {
        return { success: false, message: "User not authenticated" };
      }

      const trimmedWord = word.trim();
      if (!trimmedWord) {
        return { success: false, message: "Word cannot be empty" };
      }

      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsAdding(true);
      setError(null);

      try {
        // Check if word already exists
        const existingWord = await checkWordExists(
          user.uid,
          trimmedWord.toLowerCase(),
        );
        if (existingWord) {
          return {
            success: false,
            message: "Word already in vocabulary",
            wordId: existingWord.id,
          };
        }

        // Check if aborted
        if (controller.signal.aborted) {
          return { success: false, message: "Request cancelled" };
        }

        // Fetch word details from AI service
        const details = await generateWordDetails(trimmedWord, controller.signal);

        // Check if aborted
        if (controller.signal.aborted) {
          return { success: false, message: "Request cancelled" };
        }

        // Create vocabulary word (ensure no undefined values)
        const newWord: Omit<
          VocabularyWord,
          "id" | "createdAt" | "updatedAt" | "reviewCount"
        > = {
          word: trimmedWord.toLowerCase(),
          userId: user.uid,
          ...(details?.phonetic && { phonetic: details.phonetic }),
          ...(details?.emoji && { emoji: details.emoji }),
          definitions: details?.definitions || [],
          examples: details?.examples || [],
          synonyms: details?.synonyms || [],
          antonyms: details?.antonyms || [],
          ...(context?.sourceContext && {
            sourceContext: context.sourceContext.trim(),
          }),
          ...(context?.sourcePdfName && {
            sourcePdfName: context.sourcePdfName.trim(),
          }),
          ...(context?.sourcePage && { sourcePage: context.sourcePage }),
          tags: [],
        };

        const wordId = await addVocabularyWord(newWord);

        return { success: true, wordId, message: "Word added successfully" };
      } catch (err) {
        // Ignore abort errors
        if (isAbortError(err)) {
          return { success: false, message: "Request cancelled" };
        }
        const message =
          err instanceof Error ? err.message : "Failed to add word";
        setError(message);
        return { success: false, message };
      } finally {
        // 無條件重置 loading 狀態，避免 abort 時卡住
        setIsAdding(false);
      }
    },
    [user],
  );

  // Lookup word in vocabulary, add if not exists, return definition either way
  const lookupOrAddWord = useCallback(
    async (
      word: string,
      context?: {
        sourceContext?: string;
        sourcePdfName?: string;
        sourcePage?: number;
      },
    ): Promise<{
      success: boolean;
      existingWord?: VocabularyWord;
      isNew: boolean;
      message?: string;
    }> => {
      if (!user) {
        return { success: false, isNew: false, message: "User not authenticated" };
      }

      const trimmedWord = word.trim();
      if (!trimmedWord) {
        return { success: false, isNew: false, message: "Word cannot be empty" };
      }

      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsAdding(true);
      setError(null);

      try {
        // Check if word already exists
        const existingWord = await checkWordExists(
          user.uid,
          trimmedWord.toLowerCase(),
        );
        if (existingWord) {
          // Word exists, return its definition
          return {
            success: true,
            existingWord,
            isNew: false,
            message: "Word found in vocabulary",
          };
        }

        // Check if aborted
        if (controller.signal.aborted) {
          return { success: false, isNew: false, message: "Request cancelled" };
        }

        // Word doesn't exist, fetch details and add it
        const details = await generateWordDetails(trimmedWord, controller.signal);

        // Check if aborted
        if (controller.signal.aborted) {
          return { success: false, isNew: false, message: "Request cancelled" };
        }

        // Create vocabulary word
        const newWord: Omit<
          VocabularyWord,
          "id" | "createdAt" | "updatedAt" | "reviewCount"
        > = {
          word: trimmedWord.toLowerCase(),
          userId: user.uid,
          ...(details?.phonetic && { phonetic: details.phonetic }),
          ...(details?.emoji && { emoji: details.emoji }),
          definitions: details?.definitions || [],
          examples: details?.examples || [],
          synonyms: details?.synonyms || [],
          antonyms: details?.antonyms || [],
          ...(context?.sourceContext && {
            sourceContext: context.sourceContext.trim(),
          }),
          ...(context?.sourcePdfName && {
            sourcePdfName: context.sourcePdfName.trim(),
          }),
          ...(context?.sourcePage && { sourcePage: context.sourcePage }),
          tags: [],
        };

        const wordId = await addVocabularyWord(newWord);

        // Return the newly created word with its details
        const createdWord: VocabularyWord = {
          ...newWord,
          id: wordId,
          createdAt: new Date(),
          updatedAt: new Date(),
          reviewCount: 0,
        };

        return {
          success: true,
          existingWord: createdWord,
          isNew: true,
          message: "Word added to vocabulary",
        };
      } catch (err) {
        // Ignore abort errors
        if (isAbortError(err)) {
          return { success: false, isNew: false, message: "Request cancelled" };
        }
        const message =
          err instanceof Error ? err.message : "Failed to lookup word";
        setError(message);
        return { success: false, isNew: false, message };
      } finally {
        // 無條件重置 loading 狀態，避免 abort 時卡住
        setIsAdding(false);
      }
    },
    [user],
  );

  // Load user's vocabulary with pagination
  const loadVocabulary = useCallback(
    async (filters?: VocabularyFilters) => {
      if (!user) {
        return;
      }

      // 使用請求 ID 來追蹤最新的請求，避免競爭條件
      const requestId = ++loadRequestIdRef.current;

      setLoading(true);
      setError(null);
      currentFiltersRef.current = filters;

      try {
        const result = await getUserVocabulary(user.uid, filters);

        // 確認這是最新的請求
        if (requestId !== loadRequestIdRef.current) return;

        setWords(result.words);
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      } catch (err) {
        // Ignore abort errors or outdated requests
        if (isAbortError(err) || requestId !== loadRequestIdRef.current) return;
        const message =
          err instanceof Error ? err.message : "Failed to load vocabulary";
        setError(message);
      } finally {
        // 只有最新的請求才更新 loading 狀態
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [user],
  );

  // Load more vocabulary words (pagination)
  const loadMore = useCallback(async () => {
    if (!user || !hasMore || !lastDocId || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const filters = {
        ...currentFiltersRef.current,
        cursor: lastDocId,
      };
      const result = await getUserVocabulary(user.uid, filters);
      // Deduplicate words to prevent React key warnings
      setWords((prev) => {
        const existingIds = new Set(prev.map((w) => w.id));
        const newWords = result.words.filter((w) => !existingIds.has(w.id));
        return [...prev, ...newWords];
      });
      setHasMore(result.hasMore);
      setLastDocId(result.lastDocId);
    } catch (err) {
      // Ignore abort errors
      if (isAbortError(err)) return;
      const message =
        err instanceof Error ? err.message : "Failed to load more vocabulary";
      setError(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, hasMore, lastDocId, isLoadingMore]);

  // Get a single word (does not affect global loading state)
  const getWord = useCallback(async (wordId: string) => {
    setError(null);

    try {
      return await getVocabularyWord(wordId);
    } catch (err) {
      // Ignore abort errors
      if (isAbortError(err)) return null;
      const message = err instanceof Error ? err.message : "Failed to get word";
      setError(message);
      return null;
    }
  }, []);

  // Update a word (does not affect global loading state)
  const updateWord = useCallback(
    async (wordId: string, updates: Partial<VocabularyWord>) => {
      setError(null);

      try {
        await updateVocabularyWord(wordId, updates);
        // Update only the specific word in the list
        setWords((prev) =>
          prev.map((w) => (w.id === wordId ? { ...w, ...updates } : w)),
        );
        return { success: true };
      } catch (err) {
        // Ignore abort errors
        if (isAbortError(err)) {
          return { success: false, message: "Request cancelled" };
        }
        const message =
          err instanceof Error ? err.message : "Failed to update word";
        setError(message);
        return { success: false, message };
      }
    },
    [],
  );

  // Delete a word (does not affect global loading state)
  const deleteWord = useCallback(async (wordId: string) => {
    setError(null);

    try {
      await deleteVocabularyWord(wordId);
      setWords((prev) => prev.filter((w) => w.id !== wordId));
      return { success: true };
    } catch (err) {
      // Ignore abort errors
      if (isAbortError(err)) {
        return { success: false, message: "Request cancelled" };
      }
      const message =
        err instanceof Error ? err.message : "Failed to delete word";
      setError(message);
      return { success: false, message };
    }
  }, []);

  // Get user's tags
  const getTags = useCallback(async () => {
    if (!user) return [];

    try {
      return await getUserTags(user.uid);
    } catch (err) {
      // Ignore abort errors
      if (isAbortError(err)) return [];
      console.error("Failed to get tags:", err);
      return [];
    }
  }, [user]);

  // Update review statistics (remembered or forgot)
  const updateReview = useCallback(
    async (wordId: string, remembered: boolean) => {
      try {
        await updateReviewStats(wordId, remembered);
        // Update local state
        setWords((prev) =>
          prev.map((w) =>
            w.id === wordId
              ? {
                  ...w,
                  reviewCount: (w.reviewCount || 0) + 1,
                  lastReviewedAt: new Date(),
                  rememberedCount: remembered
                    ? (w.rememberedCount || 0) + 1
                    : w.rememberedCount,
                  forgotCount: !remembered
                    ? (w.forgotCount || 0) + 1
                    : w.forgotCount,
                }
              : w,
          ),
        );
        return { success: true };
      } catch (err) {
        console.error("Failed to update review stats:", err);
        return { success: false };
      }
    },
    [],
  );

  // Regenerate word details using AI
  const regenerateWordDetails = useCallback(
    async (
      wordId: string,
      word: string,
      signal?: AbortSignal,
    ): Promise<{
      success: boolean;
      message?: string;
      updatedWord?: Partial<VocabularyWord>;
    }> => {
      try {
        // Fetch new word details from AI service
        const details = await generateWordDetails(word, signal);

        if (!details) {
          return { success: false, message: "無法取得 AI 生成的內容" };
        }

        // 檢查是否已被取消
        if (signal?.aborted) {
          return { success: false, message: "Request cancelled" };
        }

        const updates: Partial<VocabularyWord> = {
          ...(details.phonetic && { phonetic: details.phonetic }),
          ...(details.emoji && { emoji: details.emoji }),
          definitions: details.definitions || [],
          examples: details.examples || [],
          synonyms: details.synonyms || [],
          antonyms: details.antonyms || [],
        };

        // Update in Firestore
        await updateVocabularyWord(wordId, updates);

        // Update local state
        setWords((prev) =>
          prev.map((w) => (w.id === wordId ? { ...w, ...updates } : w)),
        );

        return {
          success: true,
          message: "已重新生成解釋",
          updatedWord: updates,
        };
      } catch (err) {
        if (isAbortError(err)) {
          return { success: false, message: "Request cancelled" };
        }
        console.error("Failed to regenerate word details:", err);
        const message = err instanceof Error ? err.message : "重新生成失敗";
        return { success: false, message };
      }
    },
    [],
  );

  // Load words for review mode with smart or tag-based selection
  const loadWordsForReview = useCallback(
    async (
      maxWords: number = 10,
      mode: ReviewMode = "smart",
      selectedTag?: string,
    ): Promise<VocabularyWord[]> => {
      if (!user) return [];

      try {
        return await getVocabularyForReview(user.uid, maxWords, mode, selectedTag);
      } catch (err) {
        console.error("Failed to load words for review:", err);
        return [];
      }
    },
    [user],
  );

  // Search all vocabulary words (not just loaded ones)
  const searchWords = useCallback(
    async (searchQuery: string): Promise<VocabularyWord[]> => {
      if (!user) return [];

      try {
        return await searchUserVocabulary(user.uid, searchQuery);
      } catch (err) {
        console.error("Failed to search words:", err);
        return [];
      }
    },
    [user],
  );

  return {
    words,
    loading,
    isLoadingMore,
    isAdding,
    error,
    hasMore,
    addWord,
    lookupOrAddWord,
    loadVocabulary,
    loadMore,
    getWord,
    updateWord,
    deleteWord,
    getTags,
    updateReview,
    regenerateWordDetails,
    loadWordsForReview,
    searchWords,
  };
};
