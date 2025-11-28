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
} from "../services/vocabularyService";
import { geminiModel } from "../utils/firebaseUtil";
import type { VocabularyWord, VocabularyFilters } from "../types/vocabulary";

export const useVocabulary = () => {
  const { user } = useAuth();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentFiltersRef = useRef<VocabularyFilters | undefined>(undefined);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Fetch word details using Firebase AI (Gemini) for kid-friendly definitions
  const fetchWordDetails = useCallback(
    async (word: string, signal?: AbortSignal) => {
      try {
        const prompt = `你是一個幫助國小學生學習英文的字典助手。請為以下英文單字提供詳細資訊，使用簡單易懂、適合小朋友理解的詞彙。

單字：${word}

請以 JSON 格式回覆，包含以下欄位：
{
  "phonetic": "音標（如果知道的話）",
  "definitions": [
    {
      "partOfSpeech": "詞性（如 noun, verb, adjective 等）",
      "definition": "英文定義（簡單易懂）",
      "definitionChinese": "中文解釋（用小朋友能懂的方式說明）"
    }
  ],
  "examples": [
    {
      "sentence": "簡單的例句"
    }
  ],
  "synonyms": ["同義詞1", "同義詞2"],
  "antonyms": ["反義詞1", "反義詞2"]
}

請提供 2-3 個定義，2 個例句，最多 5 個同義詞和反義詞。
只回覆 JSON，不要加任何其他說明。`;

        // Check if aborted before making API call
        if (signal?.aborted) return null;

        const result = await geminiModel.generateContent(prompt);

        // Check if aborted after API call
        if (signal?.aborted) return null;

        const response = result.response;
        const text = response.text().trim();

        // Parse JSON response, handling potential markdown code blocks
        let jsonText = text;
        if (text.startsWith("```")) {
          jsonText = text
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim();
        }

        const wordData = JSON.parse(jsonText);

        return {
          ...(wordData.phonetic && { phonetic: wordData.phonetic }),
          definitions: wordData.definitions || [],
          examples: wordData.examples || [],
          synonyms: wordData.synonyms || [],
          antonyms: wordData.antonyms || [],
        };
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return null;
        console.error("Error fetching word details:", err);
        return null;
      }
    },
    [],
  );

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

      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        // Check if word already exists
        const existingWord = await checkWordExists(
          user.uid,
          word.toLowerCase(),
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

        // Fetch word details from dictionary API
        const details = await fetchWordDetails(word, controller.signal);

        // Check if aborted
        if (controller.signal.aborted) {
          return { success: false, message: "Request cancelled" };
        }

        // Create vocabulary word (ensure no undefined values)
        const newWord: Omit<
          VocabularyWord,
          "id" | "createdAt" | "updatedAt" | "reviewCount"
        > = {
          word: word.toLowerCase(),
          userId: user.uid,
          ...(details?.phonetic && { phonetic: details.phonetic }),
          definitions: details?.definitions || [],
          examples: details?.examples || [],
          synonyms: details?.synonyms || [],
          antonyms: details?.antonyms || [],
          ...(context?.sourceContext && {
            sourceContext: context.sourceContext,
          }),
          ...(context?.sourcePdfName && {
            sourcePdfName: context.sourcePdfName,
          }),
          ...(context?.sourcePage && { sourcePage: context.sourcePage }),
          tags: [],
        };

        const wordId = await addVocabularyWord(newWord);

        return { success: true, wordId, message: "Word added successfully" };
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return { success: false, message: "Request cancelled" };
        }
        const message =
          err instanceof Error ? err.message : "Failed to add word";
        setError(message);
        return { success: false, message };
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [user, fetchWordDetails],
  );

  // Load user's vocabulary with pagination
  const loadVocabulary = useCallback(
    async (filters?: VocabularyFilters) => {
      if (!user) {
        return;
      }

      setLoading(true);
      setError(null);
      currentFiltersRef.current = filters;

      try {
        const result = await getUserVocabulary(user.uid, filters);
        setWords(result.words);
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Failed to load vocabulary";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // Load more vocabulary words (pagination)
  const loadMore = useCallback(async () => {
    if (!user || !hasMore || !lastDocId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters = {
        ...currentFiltersRef.current,
        cursor: lastDocId,
      };
      const result = await getUserVocabulary(user.uid, filters);
      setWords((prev) => [...prev, ...result.words]);
      setHasMore(result.hasMore);
      setLastDocId(result.lastDocId);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Failed to load more vocabulary";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, hasMore, lastDocId]);

  // Get a single word
  const getWord = useCallback(async (wordId: string) => {
    setLoading(true);
    setError(null);

    try {
      return await getVocabularyWord(wordId);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") return null;
      const message = err instanceof Error ? err.message : "Failed to get word";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a word
  const updateWord = useCallback(
    async (wordId: string, updates: Partial<VocabularyWord>) => {
      setLoading(true);
      setError(null);

      try {
        await updateVocabularyWord(wordId, updates);
        // Reload the word in the list
        setWords((prev) =>
          prev.map((w) => (w.id === wordId ? { ...w, ...updates } : w)),
        );
        return { success: true };
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return { success: false, message: "Request cancelled" };
        }
        const message =
          err instanceof Error ? err.message : "Failed to update word";
        setError(message);
        return { success: false, message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Delete a word
  const deleteWord = useCallback(async (wordId: string) => {
    setLoading(true);
    setError(null);

    try {
      await deleteVocabularyWord(wordId);
      setWords((prev) => prev.filter((w) => w.id !== wordId));
      return { success: true };
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, message: "Request cancelled" };
      }
      const message =
        err instanceof Error ? err.message : "Failed to delete word";
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get user's tags
  const getTags = useCallback(async () => {
    if (!user) return [];

    try {
      return await getUserTags(user.uid);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") return [];
      console.error("Failed to get tags:", err);
      return [];
    }
  }, [user]);

  return {
    words,
    loading,
    error,
    hasMore,
    addWord,
    loadVocabulary,
    loadMore,
    getWord,
    updateWord,
    deleteWord,
    getTags,
  };
};
