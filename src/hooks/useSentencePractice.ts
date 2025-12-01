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
import { geminiModel } from "../utils/firebaseUtil";
import type {
  PracticeSentence,
  SentencePracticeFilters,
} from "../types/sentencePractice";

interface ParsedSentence {
  english: string;
  chinese: string;
}

export const useSentencePractice = () => {
  const { user } = useAuth();
  const [sentences, setSentences] = useState<PracticeSentence[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);

  // Cache for word definitions to avoid repeated API calls
  const wordDefinitionCache = useRef<Map<string, string>>(new Map());

  // Load sentences from Firestore
  const loadSentences = useCallback(
    async (filters?: SentencePracticeFilters) => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getUserSentences(user.uid, filters);
        setSentences(result.sentences);
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      } catch (err) {
        console.error("Failed to load sentences:", err);
        setError("載入句子失敗");
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // Load more sentences (pagination)
  const loadMore = useCallback(async () => {
    if (!user || !hasMore || !lastDocId || loading) return;

    setLoading(true);

    try {
      const result = await getUserSentences(user.uid, { cursor: lastDocId });
      setSentences((prev) => [...prev, ...result.sentences]);
      setHasMore(result.hasMore);
      setLastDocId(result.lastDocId);
    } catch (err) {
      console.error("Failed to load more sentences:", err);
      setError("載入更多句子失敗");
    } finally {
      setLoading(false);
    }
  }, [user, hasMore, lastDocId, loading]);

  // Parse and translate text using Gemini (one API call for both splitting and translation)
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
        const prompt = `你是一個幫助學生學習英文的助手。請將以下英文文字分句，並翻譯成繁體中文。

英文文字：
${text}

請以 JSON 格式回覆，格式如下：
{
  "sentences": [
    {
      "english": "完整的英文句子",
      "chinese": "對應的繁體中文翻譯"
    }
  ]
}

注意事項：
1. 根據英文標點符號（句號、問號、驚嘆號等）正確分句
2. 保持每個句子的完整性，不要拆散句子
3. 翻譯要準確、通順，使用簡單易懂的中文
4. 只回覆 JSON，不要加任何其他說明`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const responseText = response.text().trim();

        // Parse JSON response, handling potential markdown code blocks
        let jsonText = responseText;
        if (responseText.startsWith("```")) {
          jsonText = responseText
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim();
        }

        const parsed = JSON.parse(jsonText);
        const parsedSentences: ParsedSentence[] = parsed.sentences || [];

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

        return {
          success: true,
          message: `成功新增 ${parsedSentences.length} 個句子`,
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
      try {
        const prompt = `你是一個幫助學生學習英文的翻譯助手。請將以下英文翻譯成繁體中文，使用簡單易懂的詞彙。

英文原文：${english}

請只回覆翻譯後的中文，不要加任何其他說明。`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        return response.text().trim();
      } catch (err) {
        console.error("Failed to translate:", err);
        return null;
      }
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

      try {
        const prompt = `你是一個幫助學生學習英文的字典助手。請提供這個英文單字的簡短中文解釋。

單字：${word}

請用一句簡短的中文說明這個單字的意思，適合學生理解。只回覆中文解釋，不要加其他說明。`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const definition = response.text().trim();

        // Cache the result
        wordDefinitionCache.current.set(normalizedWord, definition);

        return definition;
      } catch (err) {
        console.error("Failed to get word definition:", err);
        return null;
      }
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
