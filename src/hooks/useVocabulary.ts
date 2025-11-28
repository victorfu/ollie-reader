import { useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useSettings } from "./useSettings";
import {
  addVocabularyWord,
  getUserVocabulary,
  getVocabularyWord,
  updateVocabularyWord,
  deleteVocabularyWord,
  checkWordExists,
  getUserTags,
} from "../services/vocabularyService";
import { ARGOS_TRANSLATE_API_URL, TRANSLATE_API_URL } from "../constants/api";
import { geminiModel } from "../utils/firebaseUtil";
import type { VocabularyWord, VocabularyFilters } from "../types/vocabulary";

export const useVocabulary = () => {
  const { user } = useAuth();
  const { translationApi } = useSettings();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Translate text using Firebase AI (Gemini) for kid-friendly translations
  const translateWithFirebaseAI = useCallback(
    async (text: string): Promise<string | undefined> => {
      try {
        const prompt = `你是一個幫助國小學生學習英文的翻譯助手。請將以下英文翻譯成繁體中文，使用簡單易懂、適合小朋友理解的詞彙和句子。翻譯要準確但用字要簡單，避免使用艱深的詞彙。

英文原文：${text}

請只回覆翻譯後的中文，不要加任何其他說明。`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const translatedText = response.text().trim();
        return translatedText;
      } catch (err) {
        console.error("Firebase AI translation failed:", err);
        return undefined;
      }
    },
    [],
  );

  // Fetch dictionary data from Free Dictionary API
  const fetchWordDetails = useCallback(
    async (word: string) => {
      try {
        const response = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`,
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
          return null;
        }

        const entry = data[0];

        // Extract definitions with translations
        const definitions = await Promise.all(
          entry.meanings?.flatMap(
            (meaning: {
              partOfSpeech: string;
              definitions: { definition: string }[];
            }) =>
              meaning.definitions
                ?.slice(0, 3)
                .map(async (def: { definition: string }) => {
                  // Translate definition to Chinese
                  let definitionChinese: string | undefined;
                  try {
                    if (translationApi === "FIREBASE_AI") {
                      // Use Firebase AI (Gemini) for kid-friendly translations
                      definitionChinese = await translateWithFirebaseAI(
                        def.definition,
                      );
                    } else {
                      // Get the API URL based on user settings
                      const apiUrl =
                        translationApi === "ARGOS_TRANSLATE_API_URL"
                          ? ARGOS_TRANSLATE_API_URL
                          : TRANSLATE_API_URL;

                      const translateResponse = await fetch(apiUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          text: def.definition,
                          from_lang: "en",
                          to_lang: "zh-TW",
                        }),
                      });
                      if (translateResponse.ok) {
                        const translateData = await translateResponse.json();
                        definitionChinese = translateData.text;
                      }
                    }
                  } catch (err) {
                    console.error("Translation failed:", err);
                  }

                  return {
                    partOfSpeech: meaning.partOfSpeech,
                    definition: def.definition,
                    ...(definitionChinese && { definitionChinese }),
                  };
                }),
          ) || [],
        );

        return {
          ...(entry.phonetic || entry.phonetics?.[0]?.text
            ? { phonetic: entry.phonetic || entry.phonetics[0].text }
            : {}),
          definitions,
          examples:
            entry.meanings?.flatMap(
              (meaning: { definitions: { example?: string }[] }) =>
                meaning.definitions
                  ?.filter((def: { example?: string }) => def.example)
                  .slice(0, 2)
                  .map((def: { example?: string }) => ({
                    sentence: def.example,
                  })),
            ) || [],
          synonyms:
            entry.meanings
              ?.flatMap(
                (meaning: { synonyms?: string[] }) => meaning.synonyms || [],
              )
              .slice(0, 5) || [],
          antonyms:
            entry.meanings
              ?.flatMap(
                (meaning: { antonyms?: string[] }) => meaning.antonyms || [],
              )
              .slice(0, 5) || [],
        };
      } catch (err) {
        console.error("Error fetching word details:", err);
        return null;
      }
    },
    [translationApi, translateWithFirebaseAI],
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

        // Fetch word details from dictionary API
        const details = await fetchWordDetails(word);

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
        const message =
          err instanceof Error ? err.message : "Failed to add word";
        setError(message);
        return { success: false, message };
      } finally {
        setLoading(false);
      }
    },
    [user, fetchWordDetails],
  );

  // Load user's vocabulary
  const loadVocabulary = useCallback(
    async (filters?: VocabularyFilters) => {
      if (!user) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const userWords = await getUserVocabulary(user.uid, filters);
        setWords(userWords);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load vocabulary";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // Get a single word
  const getWord = useCallback(async (wordId: string) => {
    setLoading(true);
    setError(null);

    try {
      return await getVocabularyWord(wordId);
    } catch (err) {
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
      console.error("Failed to get tags:", err);
      return [];
    }
  }, [user]);

  return {
    words,
    loading,
    error,
    addWord,
    loadVocabulary,
    getWord,
    updateWord,
    deleteWord,
    getTags,
  };
};
