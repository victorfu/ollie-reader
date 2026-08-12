import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type SetStateAction,
} from "react";
import { useAuth } from "./useAuth";
import {
  addSentences,
  getSpeechSentences,
  updateSentence,
  deleteSentence as deleteSentenceService,
  clearSpeechSentences,
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

type SentenceViewState = {
  ownerKey: string | null;
  sentences: PracticeSentence[];
  hasMore: boolean;
  lastDocId?: string;
};

type OwnedError = {
  ownerKey: string;
  message: string | null;
};

const emptyView = (ownerKey: string | null): SentenceViewState => ({
  ownerKey,
  sentences: [],
  hasMore: false,
  lastDocId: undefined,
});

const makeOwnerKey = (userId: string, speechId: string) =>
  JSON.stringify([userId, speechId]);

export const useSentencePractice = (speechId: string | null) => {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const ownerKey =
    userId && speechId ? makeOwnerKey(userId, speechId) : null;

  const [viewState, setViewState] = useState<SentenceViewState>(() =>
    emptyView(ownerKey),
  );
  const [loadingOwnerKey, setLoadingOwnerKey] = useState<string | null>(null);
  const [loadingMoreOwnerKey, setLoadingMoreOwnerKey] = useState<string | null>(
    null,
  );
  const [processingOwnerKey, setProcessingOwnerKey] = useState<string | null>(
    null,
  );
  const [errorState, setErrorState] = useState<OwnedError | null>(null);

  const wordDefinitionCache = useRef<Map<string, string>>(new Map());
  const activeOwnerKeyRef = useRef<string | null>(ownerKey);
  const loadRequestIdRef = useRef(0);
  const loadMoreRequestIdRef = useRef(0);
  const dataEpochRef = useRef(0);
  const aiOperationControllerRef = useRef<AbortController | null>(null);

  const ownsCurrentView = viewState.ownerKey === ownerKey;
  const sentences = ownsCurrentView ? viewState.sentences : [];
  const hasMore = ownsCurrentView ? viewState.hasMore : false;
  const lastDocId = ownsCurrentView ? viewState.lastDocId : undefined;
  const loading = ownerKey !== null && loadingOwnerKey === ownerKey;
  const isLoadingMore =
    ownerKey !== null && loadingMoreOwnerKey === ownerKey;
  const isProcessing =
    ownerKey !== null && processingOwnerKey === ownerKey;
  const error =
    ownerKey !== null && errorState?.ownerKey === ownerKey
      ? errorState.message
      : null;

  const isActiveOwner = useCallback(
    (operationOwnerKey: string) =>
      activeOwnerKeyRef.current === operationOwnerKey,
    [],
  );

  const setOwnedError = useCallback(
    (operationOwnerKey: string, message: string | null) => {
      if (!isActiveOwner(operationOwnerKey)) return;
      setErrorState({ ownerKey: operationOwnerKey, message });
    },
    [isActiveOwner],
  );

  const setSentences = useCallback(
    (next: SetStateAction<PracticeSentence[]>) => {
      if (!ownerKey || !isActiveOwner(ownerKey)) return;

      setViewState((previous) => {
        if (!isActiveOwner(ownerKey)) return previous;
        const current =
          previous.ownerKey === ownerKey ? previous : emptyView(ownerKey);
        const nextSentences =
          typeof next === "function" ? next(current.sentences) : next;
        return { ...current, sentences: nextSentences };
      });
    },
    [isActiveOwner, ownerKey],
  );

  const loadSentences = useCallback(
    async (filters?: SentencePracticeFilters) => {
      if (!userId || !speechId || !ownerKey) {
        setViewState(emptyView(null));
        setLoadingOwnerKey(null);
        return;
      }

      const operationOwnerKey = ownerKey;
      const requestId = ++loadRequestIdRef.current;
      const requestEpoch = ++dataEpochRef.current;

      setLoadingOwnerKey(operationOwnerKey);
      setOwnedError(operationOwnerKey, null);

      try {
        const result = await getSpeechSentences(speechId, filters);

        if (
          !isActiveOwner(operationOwnerKey) ||
          requestId !== loadRequestIdRef.current ||
          requestEpoch !== dataEpochRef.current
        ) {
          return;
        }

        setViewState({
          ownerKey: operationOwnerKey,
          sentences: result.sentences,
          hasMore: result.hasMore,
          lastDocId: result.lastDocId,
        });
      } catch (err) {
        if (
          !isActiveOwner(operationOwnerKey) ||
          requestId !== loadRequestIdRef.current
        ) {
          return;
        }
        console.error("Failed to load sentences:", err);
        setOwnedError(operationOwnerKey, "載入句子失敗");
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoadingOwnerKey((current) =>
            current === operationOwnerKey ? null : current,
          );
        }
      }
    },
    [isActiveOwner, ownerKey, setOwnedError, speechId, userId],
  );

  const loadMore = useCallback(async () => {
    if (
      !userId ||
      !speechId ||
      !ownerKey ||
      !hasMore ||
      !lastDocId ||
      isLoadingMore
    ) {
      return;
    }

    const operationOwnerKey = ownerKey;
    const requestId = ++loadMoreRequestIdRef.current;
    const requestEpoch = dataEpochRef.current;
    const cursor = lastDocId;
    setLoadingMoreOwnerKey(operationOwnerKey);

    try {
      const result = await getSpeechSentences(speechId, { cursor });
      if (
        !isActiveOwner(operationOwnerKey) ||
        requestId !== loadMoreRequestIdRef.current ||
        requestEpoch !== dataEpochRef.current
      ) {
        return;
      }

      setViewState((previous) => {
        if (
          previous.ownerKey !== operationOwnerKey ||
          !isActiveOwner(operationOwnerKey)
        ) {
          return previous;
        }
        const existingIds = new Set(
          previous.sentences.map((sentence) => sentence.id),
        );
        const newSentences = result.sentences.filter(
          (sentence) =>
            sentence.speechId === speechId && !existingIds.has(sentence.id),
        );
        return {
          ownerKey: operationOwnerKey,
          sentences: [...previous.sentences, ...newSentences],
          hasMore: result.hasMore,
          lastDocId: result.lastDocId,
        };
      });
    } catch (err) {
      if (
        !isActiveOwner(operationOwnerKey) ||
        requestId !== loadMoreRequestIdRef.current
      ) {
        return;
      }
      console.error("Failed to load more sentences:", err);
      setOwnedError(operationOwnerKey, "載入更多句子失敗");
    } finally {
      if (requestId === loadMoreRequestIdRef.current) {
        setLoadingMoreOwnerKey((current) =>
          current === operationOwnerKey ? null : current,
        );
      }
    }
  }, [
    hasMore,
    isActiveOwner,
    isLoadingMore,
    lastDocId,
    ownerKey,
    setOwnedError,
    speechId,
    userId,
  ]);

  const parseAndTranslate = useCallback(
    async (
      text: string,
    ): Promise<{ success: boolean; message?: string; count?: number }> => {
      if (!userId) return { success: false, message: "使用者未登入" };
      if (!speechId || !ownerKey) {
        return { success: false, message: "請先選擇演講版本" };
      }
      if (!text.trim()) return { success: false, message: "請輸入英文文字" };

      const operationOwnerKey = ownerKey;
      const operationSpeechId = speechId;
      aiOperationControllerRef.current?.abort();
      const controller = new AbortController();
      aiOperationControllerRef.current = controller;
      setProcessingOwnerKey(operationOwnerKey);
      setOwnedError(operationOwnerKey, null);

      try {
        const parsedSentences = await parseAndTranslateSentences(
          text,
          controller.signal,
        );

        if (controller.signal.aborted) {
          return { success: false, message: "操作已取消" };
        }

        if (parsedSentences.length === 0) {
          return { success: false, message: "無法解析句子" };
        }

        const sentencesToSave = parsedSentences.map((sentence) => ({
          english: sentence.english,
          chinese: sentence.chinese,
          userId,
          speechId: operationSpeechId,
        }));
        const saved = await addSentences(sentencesToSave);
        if (saved.length !== parsedSentences.length) {
          throw new Error("新增句子的結果不完整");
        }

        const newSentences: PracticeSentence[] = parsedSentences.map(
          (sentence, index) => ({
            id: saved[index].id,
            english: sentence.english,
            chinese: sentence.chinese,
            userId,
            speechId: operationSpeechId,
            order: saved[index].order,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );

        if (isActiveOwner(operationOwnerKey)) {
          setViewState((previous) => {
            const current =
              previous.ownerKey === operationOwnerKey
                ? previous
                : emptyView(operationOwnerKey);
            const existingIds = new Set(
              current.sentences.map((sentence) => sentence.id),
            );
            return {
              ...current,
              sentences: [
                ...newSentences.filter(
                  (sentence) => !existingIds.has(sentence.id),
                ),
                ...current.sentences,
              ],
            };
          });
        }

        const hasFailedTranslation = parsedSentences.some((sentence) =>
          sentence.chinese.includes("翻譯失敗"),
        );

        return {
          success: true,
          message: hasFailedTranslation
            ? `已新增 ${parsedSentences.length} 個句子（翻譯暫時無法使用）`
            : `成功新增 ${parsedSentences.length} 個句子`,
          count: parsedSentences.length,
        };
      } catch (err) {
        if (controller.signal.aborted) {
          return { success: false, message: "操作已取消" };
        }
        console.error("Failed to parse and translate:", err);
        const message = err instanceof Error ? err.message : "處理失敗";
        if (aiOperationControllerRef.current === controller) {
          setOwnedError(operationOwnerKey, message);
        }
        return { success: false, message };
      } finally {
        if (aiOperationControllerRef.current === controller) {
          aiOperationControllerRef.current = null;
          setProcessingOwnerKey((current) =>
            current === operationOwnerKey ? null : current,
          );
        }
      }
    },
    [isActiveOwner, ownerKey, setOwnedError, speechId, userId],
  );

  const translateSingle = useCallback(
    async (
      english: string,
      signal?: AbortSignal,
    ): Promise<string | null> => {
      return translateWithAI(english, signal);
    },
    [],
  );

  const editSentence = useCallback(
    async (
      sentenceId: string,
      newEnglish: string,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!userId || !speechId || !ownerKey) {
        return { success: false, message: "使用者未登入" };
      }

      const operationOwnerKey = ownerKey;
      aiOperationControllerRef.current?.abort();
      const controller = new AbortController();
      aiOperationControllerRef.current = controller;
      setProcessingOwnerKey(operationOwnerKey);

      try {
        const newChinese = await translateSingle(
          newEnglish,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return { success: false, message: "操作已取消" };
        }
        if (!newChinese) return { success: false, message: "翻譯失敗" };

        await updateSentence(sentenceId, {
          english: newEnglish,
          chinese: newChinese,
        });

        if (isActiveOwner(operationOwnerKey)) {
          setViewState((previous) =>
            previous.ownerKey === operationOwnerKey
              ? {
                  ...previous,
                  sentences: previous.sentences.map((sentence) =>
                    sentence.id === sentenceId
                      ? {
                          ...sentence,
                          english: newEnglish,
                          chinese: newChinese,
                          updatedAt: new Date(),
                        }
                      : sentence,
                  ),
                }
              : previous,
          );
        }

        return { success: true, message: "更新成功" };
      } catch (err) {
        if (controller.signal.aborted) {
          return { success: false, message: "操作已取消" };
        }
        console.error("Failed to edit sentence:", err);
        const message = err instanceof Error ? err.message : "更新失敗";
        return { success: false, message };
      } finally {
        if (aiOperationControllerRef.current === controller) {
          aiOperationControllerRef.current = null;
          setProcessingOwnerKey((current) =>
            current === operationOwnerKey ? null : current,
          );
        }
      }
    },
    [isActiveOwner, ownerKey, speechId, translateSingle, userId],
  );

  const deleteSentence = useCallback(
    async (
      sentenceId: string,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!userId || !speechId || !ownerKey) {
        return { success: false, message: "使用者未登入" };
      }

      const operationOwnerKey = ownerKey;
      try {
        await deleteSentenceService(sentenceId);
        if (isActiveOwner(operationOwnerKey)) {
          setViewState((previous) => {
            if (previous.ownerKey !== operationOwnerKey) return previous;
            const nextSentences = previous.sentences.filter(
              (sentence) => sentence.id !== sentenceId,
            );
            return {
              ...previous,
              sentences: nextSentences,
              lastDocId:
                previous.lastDocId === sentenceId
                  ? nextSentences.at(-1)?.id
                  : previous.lastDocId,
            };
          });
        }
        return { success: true, message: "刪除成功" };
      } catch (err) {
        console.error("Failed to delete sentence:", err);
        const message = err instanceof Error ? err.message : "刪除失敗";
        return { success: false, message };
      }
    },
    [isActiveOwner, ownerKey, speechId, userId],
  );

  const clearAll = useCallback(
    async (
      targetSpeechId: string | null = speechId,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!userId) return { success: false, message: "使用者未登入" };
      if (!targetSpeechId) {
        return { success: false, message: "請先選擇演講版本" };
      }

      const operationOwnerKey = makeOwnerKey(userId, targetSpeechId);
      if (isActiveOwner(operationOwnerKey)) {
        dataEpochRef.current += 1;
        loadRequestIdRef.current += 1;
        loadMoreRequestIdRef.current += 1;
        setLoadingMoreOwnerKey((current) =>
          current === operationOwnerKey ? null : current,
        );
      }

      try {
        await clearSpeechSentences(targetSpeechId);
        if (isActiveOwner(operationOwnerKey)) {
          setViewState(emptyView(operationOwnerKey));
        }
        return { success: true, message: "已清除所有句子" };
      } catch (err) {
        console.error("Failed to clear sentences:", err);
        const message = err instanceof Error ? err.message : "清除失敗";
        setOwnedError(operationOwnerKey, message);
        if (isActiveOwner(operationOwnerKey)) {
          void loadSentences();
        }
        return { success: false, message };
      }
    },
    [isActiveOwner, loadSentences, setOwnedError, speechId, userId],
  );

  const reorderSentences = useCallback(
    async (
      reorderedList: PracticeSentence[],
    ): Promise<{ success: boolean; message?: string }> => {
      if (!userId || !speechId || !ownerKey) {
        return { success: false, message: "使用者未登入" };
      }
      if (
        reorderedList.some(
          (sentence) => !sentence.id || sentence.speechId !== speechId,
        )
      ) {
        return { success: false, message: "排序清單不屬於目前演講版本" };
      }

      const operationOwnerKey = ownerKey;
      const orderedIds = reorderedList.map((sentence) => sentence.id!);
      if (isActiveOwner(operationOwnerKey)) {
        dataEpochRef.current += 1;
        loadMoreRequestIdRef.current += 1;
        setViewState((previous) =>
          previous.ownerKey === operationOwnerKey
            ? { ...previous, sentences: reorderedList }
            : previous,
        );
      }

      try {
        const updates = await updateSentenceOrders(speechId, orderedIds);
        const orderById = new Map(
          updates.map((update) => [update.id, update.order]),
        );

        if (isActiveOwner(operationOwnerKey)) {
          dataEpochRef.current += 1;
          setViewState((previous) => {
            if (previous.ownerKey !== operationOwnerKey) return previous;
            const nextSentences = previous.sentences
              .map((sentence) => {
                const persistedOrder = orderById.get(sentence.id!);
                return persistedOrder === undefined
                  ? sentence
                  : { ...sentence, order: persistedOrder };
              })
              .sort(
                (left, right) =>
                  (left.order ?? Number.MAX_SAFE_INTEGER) -
                  (right.order ?? Number.MAX_SAFE_INTEGER),
              );
            return {
              ...previous,
              sentences: nextSentences,
              lastDocId: nextSentences.at(-1)?.id,
            };
          });
        }

        return { success: true };
      } catch (err) {
        console.error("Failed to reorder sentences:", err);
        const message = err instanceof Error ? err.message : "排序失敗";
        if (isActiveOwner(operationOwnerKey)) {
          dataEpochRef.current += 1;
          await loadSentences();
          setOwnedError(operationOwnerKey, message);
        }
        return { success: false, message };
      }
    },
    [
      isActiveOwner,
      loadSentences,
      ownerKey,
      setOwnedError,
      speechId,
      userId,
    ],
  );

  const getWordDefinition = useCallback(
    async (word: string, signal?: AbortSignal): Promise<string | null> => {
      const normalizedWord = word.toLowerCase().trim();

      if (wordDefinitionCache.current.has(normalizedWord)) {
        return wordDefinitionCache.current.get(normalizedWord) || null;
      }

      const definition = await getWordDefinitionAI(word, signal);
      if (definition) {
        wordDefinitionCache.current.set(normalizedWord, definition);
      }

      return definition;
    },
    [],
  );

  useEffect(() => {
    const staleController = aiOperationControllerRef.current;
    staleController?.abort();
    if (aiOperationControllerRef.current === staleController) {
      aiOperationControllerRef.current = null;
    }
    // Only one parse/edit operation may exist. Clear ownership immediately so
    // an A→B→A switch cannot resurrect an abort-ignoring A spinner.
    setProcessingOwnerKey(null);
    activeOwnerKeyRef.current = ownerKey;
    loadRequestIdRef.current += 1;
    loadMoreRequestIdRef.current += 1;
    dataEpochRef.current += 1;
  }, [ownerKey]);

  useEffect(
    () => () => {
      aiOperationControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    void loadSentences();
  }, [loadSentences]);

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
