import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import type { AudioUpload, AudioUploadUpdateInput } from "../types/audioUpload";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from "../types/audioUpload";
import {
  uploadAudioFile,
  createAudioUploadPath,
  addAudioUpload,
  getUserAudioUploads,
  updateAudioUpload as updateAudioUploadService,
  deleteAudioUpload as deleteAudioUploadService,
  getAudioUploadSignedUrl,
  deleteAudioFileForOwner,
  audioUploadMetadataExists,
  audioUploadMetadataExistsById,
} from "../services/audioUploadService";
import {
  enqueueAudioUploadCleanup,
  isOwnedAudioUploadPath,
  listAudioUploadCleanupMarkers,
  PENDING_AUDIO_METADATA_GRACE_MS,
  removeAudioUploadCleanup,
} from "../services/audioUploadCleanupQueue";
import {
  acquireAudioUploadOperationLock,
  runWithAudioUploadCleanupLock,
  type AudioUploadOperationLease,
} from "../services/audioUploadOperationLock";

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
  const audioUrlsRef = useRef<Map<string, string>>(audioUrls);
  const activeUidRef = useRef<string | null>(user?.uid ?? null);
  const loadSequenceRef = useRef(0);
  const ownerGenerationRef = useRef(0);
  const observedUidRef = useRef<string | null>(user?.uid ?? null);
  const uploadSequenceRef = useRef(0);
  const activeUploadPathsRef = useRef(new Set<string>());

  const renderedUid = user?.uid ?? null;
  if (observedUidRef.current !== renderedUid) {
    observedUidRef.current = renderedUid;
    ownerGenerationRef.current += 1;
  }
  activeUidRef.current = renderedUid;

  const isCurrentOwner = useCallback(
    (uid: string, generation: number): boolean =>
      activeUidRef.current === uid &&
      ownerGenerationRef.current === generation,
    [],
  );

  useEffect(() => {
    // React StrictMode replays setup -> cleanup -> setup in development. The
    // cleanup must still invalidate first-pass async work, while the replayed
    // setup restores the live owner for the real mounted instance.
    activeUidRef.current = observedUidRef.current;
    return () => {
      activeUidRef.current = null;
      ownerGenerationRef.current += 1;
      loadSequenceRef.current += 1;
      uploadSequenceRef.current += 1;
    };
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  /**
   * Load all audio uploads for the current user
   */
  const loadUploads = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) return;
    const generation = ownerGenerationRef.current;
    const sequence = ++loadSequenceRef.current;

    setLoading(true);
    setError(null);

    try {
      const result = await getUserAudioUploads(uid);
      if (
        !isCurrentOwner(uid, generation) ||
        loadSequenceRef.current !== sequence
      ) {
        return;
      }
      setUploads(result);
    } catch (err) {
      if (
        !isCurrentOwner(uid, generation) ||
        loadSequenceRef.current !== sequence
      ) {
        return;
      }
      console.error("Failed to load audio uploads:", err);
      setError("載入音訊列表失敗");
    } finally {
      if (
        isCurrentOwner(uid, generation) &&
        loadSequenceRef.current === sequence
      ) {
        setLoading(false);
      }
    }
  }, [isCurrentOwner, user?.uid]);

  /**
   * Get signed URL for an audio upload (with caching)
   */
  const getSignedUrl = useCallback(
    async (uploadId: string, audioUrl: string): Promise<string | null> => {
      const uid = activeUidRef.current;
      if (!uid) return null;
      const generation = ownerGenerationRef.current;
      // Check cache first (read from ref to avoid stale closure)
      const cached = audioUrlsRef.current.get(uploadId);
      if (cached) return cached;

      try {
        const signedUrl = await getAudioUploadSignedUrl(audioUrl);
        if (!isCurrentOwner(uid, generation)) return null;
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
    [isCurrentOwner],
  );

  /**
   * Refresh signed URL (e.g., after expiration error)
   */
  const refreshSignedUrl = useCallback(
    async (uploadId: string, audioUrl: string): Promise<string | null> => {
      const uid = activeUidRef.current;
      if (!uid) return null;
      const generation = ownerGenerationRef.current;
      // Clear cache and fetch new URL
      setAudioUrls((prev) => {
        const newMap = new Map(prev);
        newMap.delete(uploadId);
        return newMap;
      });

      try {
        const signedUrl = await getAudioUploadSignedUrl(audioUrl);
        if (!isCurrentOwner(uid, generation)) return null;
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
    [isCurrentOwner],
  );

  const retryPendingCleanups = useCallback(
    async (uid: string, generation: number): Promise<void> => {
      for (const marker of listAudioUploadCleanupMarkers(uid)) {
        const { audioPath } = marker;
        if (!isCurrentOwner(uid, generation)) return;
        if (activeUploadPathsRef.current.has(audioPath)) continue;
        try {
          await runWithAudioUploadCleanupLock(audioPath, async () => {
            if (
              !isCurrentOwner(uid, generation) ||
              activeUploadPathsRef.current.has(audioPath)
            ) {
              return;
            }

            if (await audioUploadMetadataExists(uid, audioPath)) {
              if (marker.reason === "orphaned-upload") {
                removeAudioUploadCleanup(
                  uid,
                  audioPath,
                  "orphaned-upload",
                );
              }
              return;
            }
            if ((marker.notBefore ?? 0) > Date.now()) return;
            if (
              !isCurrentOwner(uid, generation) ||
              activeUploadPathsRef.current.has(audioPath)
            ) {
              return;
            }
            await deleteAudioFileForOwner(uid, audioPath);
            removeAudioUploadCleanup(uid, audioPath);
          });
        } catch (cleanupError) {
          console.warn("Pending audio cleanup will be retried:", cleanupError);
        }
      }
    },
    [isCurrentOwner],
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
      const uid = user?.uid;
      if (!uid) {
        return { success: false, message: "請先登入" };
      }
      const generation = ownerGenerationRef.current;
      let activeAudioPath: string | null = null;
      let operationLease: AudioUploadOperationLease | null = null;

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

      const uploadSequence = ++uploadSequenceRef.current;
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

        if (!isCurrentOwner(uid, generation)) {
          return { success: false, message: "帳號已切換，上傳已取消" };
        }

        // Generate a temporary ID for the upload path
        const tempId = `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        const audioUrl = createAudioUploadPath(uid, tempId, file.type);
        operationLease = await acquireAudioUploadOperationLock(audioUrl);
        if (!operationLease) {
          return {
            success: false,
            message: "另一個分頁正在處理相同的音訊路徑，請重試",
          };
        }
        activeAudioPath = audioUrl;
        activeUploadPathsRef.current.add(audioUrl);

        // Persist before mutating Storage. A committed upload whose response is
        // lost is therefore still discoverable after a crash or reload.
        const cleanupRecorded = enqueueAudioUploadCleanup(uid, audioUrl, {
          reason: "orphaned-upload",
          requireDurable: true,
          notBefore: Date.now() + PENDING_AUDIO_METADATA_GRACE_MS,
        });
        if (!cleanupRecorded) {
          removeAudioUploadCleanup(uid, audioUrl, "orphaned-upload");
          return {
            success: false,
            message: "瀏覽器無法安全記錄上傳狀態，尚未上傳音訊",
          };
        }

        const makeCleanupReady = () => {
          if (
            !enqueueAudioUploadCleanup(uid, audioUrl, {
              reason: "orphaned-upload",
              requireDurable: true,
              notBefore: Date.now(),
            })
          ) {
            console.warn("Could not advance uploaded audio cleanup marker");
          }
        };

        // Upload file to the exact path already covered by the durable marker.
        try {
          await uploadAudioFile(uid, audioUrl, file, file.type);
        } catch (uploadError) {
          makeCleanupReady();
          throw uploadError;
        }

        if (!isCurrentOwner(uid, generation)) {
          makeCleanupReady();
          return { success: false, message: "帳號已切換，上傳已取消" };
        }

        // Save metadata to Firestore through a non-offline-queued transaction.
        let uploadId: string;
        try {
          uploadId = await addAudioUpload(tempId, {
            userId: uid,
            title: title.trim(),
            description: description?.trim(),
            audioUrl,
            durationSeconds,
            fileSize: file.size,
            mimeType: file.type,
          });
        } catch (metadataError) {
          makeCleanupReady();
          let metadataExists: boolean | null = null;
          try {
            metadataExists = await audioUploadMetadataExistsById(
              uid,
              tempId,
              audioUrl,
            );
          } catch (verificationError) {
            console.warn(
              "Audio metadata outcome is ambiguous; cleanup was deferred:",
              verificationError,
            );
          }

          if (metadataExists) {
            removeAudioUploadCleanup(uid, audioUrl, "orphaned-upload");
            if (isCurrentOwner(uid, generation)) await loadUploads();
            return { success: true, message: "音訊上傳成功" };
          }

          if (
            metadataExists === false &&
            isCurrentOwner(uid, generation)
          ) {
            try {
              await deleteAudioFileForOwner(uid, audioUrl);
              removeAudioUploadCleanup(uid, audioUrl, "orphaned-upload");
            } catch (cleanupError) {
              console.error(
                "Failed to roll back uploaded audio after metadata failure:",
                cleanupError,
              );
            }
          }
          throw metadataError;
        }

        removeAudioUploadCleanup(uid, audioUrl, "orphaned-upload");

        // Reload uploads
        if (isCurrentOwner(uid, generation)) await loadUploads();

        return { success: true, message: "音訊上傳成功", uploadId };
      } catch (err) {
        console.error("Failed to upload audio:", err);
        const message = err instanceof Error ? err.message : "音訊上傳失敗";
        if (isCurrentOwner(uid, generation)) setError(message);
        return { success: false, message };
      } finally {
        if (activeAudioPath) {
          activeUploadPathsRef.current.delete(activeAudioPath);
        }
        operationLease?.release();
        if (
          isCurrentOwner(uid, generation) &&
          uploadSequenceRef.current === uploadSequence
        ) {
          setUploading(false);
        }
      }
    },
    [isCurrentOwner, user?.uid, loadUploads],
  );

  /**
   * Update audio upload metadata (title, description)
   */
  const updateUpload = useCallback(
    async (
      uploadId: string,
      updates: AudioUploadUpdateInput,
    ): Promise<{ success: boolean; message: string }> => {
      const uid = user?.uid;
      if (!uid) {
        return { success: false, message: "請先登入" };
      }
      const generation = ownerGenerationRef.current;

      try {
        await updateAudioUploadService(uploadId, updates);
        if (!isCurrentOwner(uid, generation)) {
          return { success: true, message: "更新成功" };
        }

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
    [isCurrentOwner, user?.uid],
  );

  /**
   * Delete an audio upload
   */
  const deleteUpload = useCallback(
    async (
      uploadId: string,
      audioUrl: string,
    ): Promise<{ success: boolean; message: string }> => {
      const uid = user?.uid;
      if (!uid) {
        return { success: false, message: "請先登入" };
      }
      const generation = ownerGenerationRef.current;

      if (!isOwnedAudioUploadPath(uid, audioUrl)) {
        return { success: false, message: "音訊檔案路徑不屬於目前帳號" };
      }

      const cleanupRecorded = enqueueAudioUploadCleanup(uid, audioUrl, {
        reason: "deleted-record",
        requireDurable: true,
      });
      if (!cleanupRecorded) {
        removeAudioUploadCleanup(uid, audioUrl, "deleted-record");
        return {
          success: false,
          message: "瀏覽器無法安全記錄刪除狀態，尚未刪除音訊",
        };
      }

      try {
        try {
          await deleteAudioUploadService(uploadId);
        } catch (metadataDeleteError) {
          let metadataExists: boolean | null = null;
          try {
            metadataExists = await audioUploadMetadataExistsById(
              uid,
              uploadId,
              audioUrl,
            );
          } catch (verificationError) {
            console.warn(
              "Audio deletion outcome is ambiguous; Storage was preserved:",
              verificationError,
            );
          }

          if (metadataExists !== false) throw metadataDeleteError;
        }

        if (isCurrentOwner(uid, generation)) {
          // Update local state immediately; a Storage outage must not resurrect
          // a logically deleted item in the UI.
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));

          // Clear cached URL
          setAudioUrls((prev) => {
            const newMap = new Map(prev);
            newMap.delete(uploadId);
            return newMap;
          });

          void runWithAudioUploadCleanupLock(audioUrl, async () => {
            await deleteAudioFileForOwner(uid, audioUrl);
            removeAudioUploadCleanup(uid, audioUrl);
          })
            .catch((cleanupError: unknown) => {
              console.warn(
                "Deleted audio metadata; Storage cleanup will be retried:",
                cleanupError,
              );
            });
        }

        return { success: true, message: "音訊已刪除" };
      } catch (err) {
        console.error("Failed to delete audio upload:", err);
        return { success: false, message: "刪除失敗" };
      }
    },
    [isCurrentOwner, user?.uid],
  );

  // Load uploads on mount
  useEffect(() => {
    loadSequenceRef.current += 1;
    setUploads([]);
    setAudioUrls(new Map());
    audioUrlsRef.current = new Map();
    setError(null);
    setLoading(false);
    setUploading(false);
    const uid = user?.uid;
    const generation = ownerGenerationRef.current;
    if (uid) {
      const retryCleanup = () => {
        void retryPendingCleanups(uid, generation);
      };
      retryCleanup();
      window.addEventListener("online", retryCleanup);
      void loadUploads();
      return () => window.removeEventListener("online", retryCleanup);
    }
  }, [user?.uid, loadUploads, retryPendingCleanups]);

  return {
    uploads: uploads.filter((upload) => upload.userId === user?.uid),
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
