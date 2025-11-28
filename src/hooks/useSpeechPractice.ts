import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./useAuth";
import type { PracticeRecord, PracticeFilters } from "../types/speechPractice";
import {
  addPracticeRecord,
  getUserPracticeRecords,
  deletePracticeRecord,
  getPracticeCountByTopic,
  getUserScripts,
  saveTopicScript,
  getTopicScript,
  updatePracticeRecordUrl,
} from "../services/speechPracticeService";
import {
  uploadPracticeAudio,
  MAX_AUDIO_SIZE_BYTES,
} from "../services/audioStorageService";

export function useSpeechPractice() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicCounts, setTopicCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [topicScripts, setTopicScripts] = useState<Map<string, string>>(
    new Map(),
  );

  const loadRecords = useCallback(
    async (filters?: PracticeFilters) => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getUserPracticeRecords(user.uid, filters);
        setRecords(result);
      } catch (err) {
        console.error("Failed to load practice records:", err);
        setError("載入練習記錄失敗");
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const loadTopicCounts = useCallback(async () => {
    if (!user) return;

    try {
      const counts = await getPracticeCountByTopic(user.uid);
      setTopicCounts(counts);
    } catch (err) {
      console.error("Failed to load topic counts:", err);
    }
  }, [user]);

  const loadTopicScripts = useCallback(async () => {
    if (!user) return;

    try {
      const scripts = await getUserScripts(user.uid);
      setTopicScripts(scripts);
    } catch (err) {
      console.error("Failed to load topic scripts:", err);
    }
  }, [user]);

  const saveScript = useCallback(
    async (
      topicId: string,
      script: string,
    ): Promise<{ success: boolean; message: string }> => {
      if (!user) {
        return { success: false, message: "請先登入" };
      }

      try {
        await saveTopicScript(user.uid, topicId, script);

        // Update local state
        setTopicScripts((prev) => {
          const newMap = new Map(prev);
          newMap.set(topicId, script);
          return newMap;
        });

        return { success: true, message: "講稿已儲存" };
      } catch (err) {
        console.error("Failed to save script:", err);
        return { success: false, message: "儲存講稿失敗" };
      }
    },
    [user],
  );

  const loadScript = useCallback(
    async (topicId: string): Promise<string | null> => {
      if (!user) return null;

      try {
        const script = await getTopicScript(user.uid, topicId);
        return script?.script || null;
      } catch (err) {
        console.error("Failed to load script:", err);
        return null;
      }
    },
    [user],
  );

  const saveRecord = useCallback(
    async (
      record: Omit<PracticeRecord, "id" | "createdAt" | "userId">,
      audioBlob?: Blob | null,
    ): Promise<{ success: boolean; message: string; recordId?: string }> => {
      if (!user) {
        return { success: false, message: "請先登入" };
      }

      // Validate audio size if provided
      if (audioBlob && audioBlob.size > MAX_AUDIO_SIZE_BYTES) {
        return {
          success: false,
          message: `錄音檔案過大，最大允許 10MB，目前大小 ${(
            audioBlob.size /
            1024 /
            1024
          ).toFixed(2)}MB`,
        };
      }

      try {
        // First, save the practice record to get the ID
        const recordId = await addPracticeRecord({
          ...record,
          userId: user.uid,
        });

        // If audio blob is provided, upload it and update the record
        if (audioBlob) {
          try {
            const audioUrl = await uploadPracticeAudio(
              user.uid,
              recordId,
              audioBlob,
            );
            await updatePracticeRecordUrl(recordId, audioUrl);
          } catch (audioErr) {
            console.error("Failed to upload audio:", audioErr);
            // Record is saved, but audio upload failed
            // Still return success but with a warning message
            await loadRecords();
            await loadTopicCounts();
            return {
              success: true,
              message: "練習記錄已儲存，但錄音上傳失敗",
              recordId,
            };
          }
        }

        // Reload records and counts after saving
        await loadRecords();
        await loadTopicCounts();

        return { success: true, message: "練習記錄已儲存", recordId };
      } catch (err) {
        console.error("Failed to save practice record:", err);
        return { success: false, message: "儲存練習記錄失敗" };
      }
    },
    [user, loadRecords, loadTopicCounts],
  );

  const deleteRecord = useCallback(
    async (
      recordId: string,
    ): Promise<{ success: boolean; message: string }> => {
      if (!user) {
        return { success: false, message: "請先登入" };
      }

      try {
        await deletePracticeRecord(recordId, user.uid);

        // Update local state
        setRecords((prev) => prev.filter((r) => r.id !== recordId));
        await loadTopicCounts();

        return { success: true, message: "練習記錄已刪除" };
      } catch (err) {
        console.error("Failed to delete practice record:", err);
        return { success: false, message: "刪除練習記錄失敗" };
      }
    },
    [user, loadTopicCounts],
  );

  // Load records on mount
  useEffect(() => {
    if (user) {
      void loadRecords();
      void loadTopicCounts();
      void loadTopicScripts();
    }
  }, [user, loadRecords, loadTopicCounts, loadTopicScripts]);

  return {
    records,
    loading,
    error,
    topicCounts,
    topicScripts,
    loadRecords,
    saveRecord,
    deleteRecord,
    saveScript,
    loadScript,
  };
}
