import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./useAuth";
import type { AudioUpload, AudioUploadUpdateInput } from "../types/audioUpload";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from "../types/audioUpload";
import {
  uploadAudioFile,
  addAudioUpload,
  getUserAudioUploads,
  updateAudioUpload as updateAudioUploadService,
  deleteAudioUpload as deleteAudioUploadService,
  getAudioUploadSignedUrl,
} from "../services/audioUploadService";

/**
 * Helper function to detect audio duration from a file
 */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);

    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(objectUrl);
      // Round to nearest second
      const durationSeconds = Math.round(audio.duration);
      resolve(durationSeconds);
    });

    audio.addEventListener("error", (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`無法讀取音訊檔案: ${e.message || "格式不支援"}`));
    });

    audio.src = objectUrl;
  });
}

export function useAudioUploads() {
  const { user } = useAuth();
  const [uploads, setUploads] = useState<AudioUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Map<string, string>>(new Map());

  /**
   * Load all audio uploads for the current user
   */
  const loadUploads = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getUserAudioUploads(user.uid);
      setUploads(result);
    } catch (err) {
      console.error("Failed to load audio uploads:", err);
      setError("載入音訊列表失敗");
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Get signed URL for an audio upload (with caching)
   */
  const getSignedUrl = useCallback(
    async (uploadId: string, audioUrl: string): Promise<string | null> => {
      // Check cache first
      const cached = audioUrls.get(uploadId);
      if (cached) return cached;

      try {
        const signedUrl = await getAudioUploadSignedUrl(audioUrl);
        setAudioUrls((prev) => {
          const newMap = new Map(prev);
          newMap.set(uploadId, signedUrl);
          return newMap;
        });
        return signedUrl;
      } catch (err) {
        console.error("Failed to get signed URL:", err);
        return null;
      }
    },
    [audioUrls],
  );

  /**
   * Refresh signed URL (e.g., after expiration error)
   */
  const refreshSignedUrl = useCallback(
    async (uploadId: string, audioUrl: string): Promise<string | null> => {
      // Clear cache and fetch new URL
      setAudioUrls((prev) => {
        const newMap = new Map(prev);
        newMap.delete(uploadId);
        return newMap;
      });

      try {
        const signedUrl = await getAudioUploadSignedUrl(audioUrl);
        setAudioUrls((prev) => {
          const newMap = new Map(prev);
          newMap.set(uploadId, signedUrl);
          return newMap;
        });
        return signedUrl;
      } catch (err) {
        console.error("Failed to refresh signed URL:", err);
        return null;
      }
    },
    [],
  );

  /**
   * Upload a new audio file
   */
  const uploadAudio = useCallback(
    async (
      file: File,
      title: string,
      description?: string,
    ): Promise<{ success: boolean; message: string; uploadId?: string }> => {
      if (!user) {
        return { success: false, message: "請先登入" };
      }

      // Validate file size
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        return {
          success: false,
          message: `檔案過大，最大允許 ${MAX_UPLOAD_SIZE_MB}MB，目前大小 ${(
            file.size /
            1024 /
            1024
          ).toFixed(2)}MB`,
        };
      }

      // Validate title
      if (!title.trim()) {
        return { success: false, message: "請輸入標題" };
      }

      setUploading(true);
      setError(null);

      try {
        // Detect audio duration
        let durationSeconds = 0;
        try {
          durationSeconds = await getAudioDuration(file);
        } catch (durationErr) {
          console.warn("Failed to detect audio duration:", durationErr);
          // Continue without duration
        }

        // Generate a temporary ID for the upload path
        const tempId = `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Upload file to GCS
        const audioUrl = await uploadAudioFile(
          user.uid,
          tempId,
          file,
          file.type,
        );

        // Save metadata to Firestore
        const uploadId = await addAudioUpload({
          userId: user.uid,
          title: title.trim(),
          description: description?.trim(),
          audioUrl,
          durationSeconds,
          fileSize: file.size,
          mimeType: file.type,
        });

        // Reload uploads
        await loadUploads();

        return { success: true, message: "音訊上傳成功", uploadId };
      } catch (err) {
        console.error("Failed to upload audio:", err);
        const message = err instanceof Error ? err.message : "音訊上傳失敗";
        setError(message);
        return { success: false, message };
      } finally {
        setUploading(false);
      }
    },
    [user, loadUploads],
  );

  /**
   * Update audio upload metadata (title, description)
   */
  const updateUpload = useCallback(
    async (
      uploadId: string,
      updates: AudioUploadUpdateInput,
    ): Promise<{ success: boolean; message: string }> => {
      if (!user) {
        return { success: false, message: "請先登入" };
      }

      try {
        await updateAudioUploadService(uploadId, updates);

        // Update local state
        setUploads((prev) =>
          prev.map((upload) =>
            upload.id === uploadId ? { ...upload, ...updates } : upload,
          ),
        );

        return { success: true, message: "更新成功" };
      } catch (err) {
        console.error("Failed to update audio upload:", err);
        return { success: false, message: "更新失敗" };
      }
    },
    [user],
  );

  /**
   * Delete an audio upload
   */
  const deleteUpload = useCallback(
    async (
      uploadId: string,
      audioUrl: string,
    ): Promise<{ success: boolean; message: string }> => {
      if (!user) {
        return { success: false, message: "請先登入" };
      }

      try {
        await deleteAudioUploadService(uploadId, audioUrl);

        // Update local state
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));

        // Clear cached URL
        setAudioUrls((prev) => {
          const newMap = new Map(prev);
          newMap.delete(uploadId);
          return newMap;
        });

        return { success: true, message: "音訊已刪除" };
      } catch (err) {
        console.error("Failed to delete audio upload:", err);
        return { success: false, message: "刪除失敗" };
      }
    },
    [user],
  );

  // Load uploads on mount
  useEffect(() => {
    if (user) {
      void loadUploads();
    }
  }, [user, loadUploads]);



  return {
    uploads,
    loading,
    uploading,
    error,
    audioUrls,
    loadUploads,
    uploadAudio,
    updateUpload,
    deleteUpload,
    getSignedUrl,
    refreshSignedUrl,
  };
}
