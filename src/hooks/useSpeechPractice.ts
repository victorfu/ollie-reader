import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
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
  beginPracticeAudioUpload,
  completePracticeAudioUpload,
  resolvePracticeAudioCleanup,
} from "../services/speechPracticeService";
import {
  uploadPracticeAudio,
  deletePracticeAudio,
  getPracticeAudioPath,
  MAX_AUDIO_SIZE_BYTES,
} from "../services/audioStorageService";
import {
  enqueuePracticeAudioCleanup,
  removePracticeAudioCleanup,
  retryPracticeAudioCleanupQueue,
  runWithPracticeAudioOperationLock,
  type PendingPracticeAudioCleanup,
} from "../services/practiceAudioCleanupQueue";

const AUDIO_OPERATION_LEASE_MS = 120_000;
const AUDIO_OPERATION_HEARTBEAT_MS = 30_000;

function newAudioOperationId(): string {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `upload-${Date.now().toString(36)}-${randomPart}`;
}

export function useSpeechPractice() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [lastRecordId, setLastRecordId] = useState<string | undefined>();
  const [topicCounts, setTopicCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [topicScripts, setTopicScripts] = useState<Map<string, string>>(
    new Map(),
  );
  const [stateOwnerUid, setStateOwnerUid] = useState<string | undefined>(uid);
  const activeUidRef = useRef(uid);
  const mountedRef = useRef(false);
  const identityUidRef = useRef(uid);
  const ownerGenerationRef = useRef(0);
  const recordsGenerationRef = useRef(0);
  const topicCountsGenerationRef = useRef(0);
  const topicScriptsGenerationRef = useRef(0);
  const recordsFiltersRef = useRef<PracticeFilters | undefined>(undefined);
  const loadMoreInFlightRef = useRef(false);
  const activeAudioOperationIdsRef = useRef(new Set<string>());
  if (identityUidRef.current !== uid) {
    identityUidRef.current = uid;
    ownerGenerationRef.current += 1;
  }
  activeUidRef.current = uid;

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ownerGenerationRef.current += 1;
    };
  }, []);

  const captureOwnerGuard = useCallback((ownerUid: string) => {
    const generation = ownerGenerationRef.current;
    return () => (
      mountedRef.current
      && ownerGenerationRef.current === generation
      && activeUidRef.current === ownerUid
    );
  }, []);

  const loadRecords = useCallback(
    async (filters?: PracticeFilters) => {
      const operationUid = uid;
      if (!operationUid || activeUidRef.current !== operationUid) {
        if (!operationUid && activeUidRef.current === undefined) {
          setRecords([]);
          setHasMoreRecords(false);
          setLastRecordId(undefined);
          setLoading(false);
        }
        return;
      }
      const isOwnerActive = captureOwnerGuard(operationUid);

      const generation = ++recordsGenerationRef.current;
      loadMoreInFlightRef.current = false;
      setIsLoadingMore(false);
      recordsFiltersRef.current = filters
        ? { ...filters, cursor: undefined }
        : undefined;

      setLoading(true);
      setError(null);

      try {
        const result = await getUserPracticeRecords(
          operationUid,
          filters,
          isOwnerActive,
        );
        if (
          generation !== recordsGenerationRef.current
          || !isOwnerActive()
        ) return;
        setRecords(result.records);
        setHasMoreRecords(result.hasMore);
        setLastRecordId(result.lastDocId);
      } catch (err) {
        if (
          generation !== recordsGenerationRef.current
          || !isOwnerActive()
        ) return;
        console.error("Failed to load practice records:", err);
        setError("載入練習記錄失敗");
      } finally {
        if (
          generation === recordsGenerationRef.current
          && isOwnerActive()
        ) {
          setLoading(false);
        }
      }
    },
    [captureOwnerGuard, uid],
  );

  const loadMoreRecords = useCallback(async () => {
    if (
      !uid
      || activeUidRef.current !== uid
      || !hasMoreRecords
      || !lastRecordId
      || loadMoreInFlightRef.current
    ) return;

    const operationUid = uid;
    const isOwnerActive = captureOwnerGuard(operationUid);
    const generation = recordsGenerationRef.current;
    loadMoreInFlightRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    try {
      const result = await getUserPracticeRecords(operationUid, {
        ...recordsFiltersRef.current,
        cursor: lastRecordId,
      }, isOwnerActive);
      if (
        generation !== recordsGenerationRef.current
        || !isOwnerActive()
      ) return;
      setRecords((current) => {
        const existingIds = new Set(current.map((record) => record.id));
        return [
          ...current,
          ...result.records.filter((record) => !existingIds.has(record.id)),
        ];
      });
      setHasMoreRecords(result.hasMore);
      setLastRecordId(result.lastDocId);
    } catch (err) {
      if (
        generation !== recordsGenerationRef.current
        || !isOwnerActive()
      ) return;
      console.error("Failed to load more practice records:", err);
      setError("載入更多練習記錄失敗");
    } finally {
      if (
        generation === recordsGenerationRef.current
        && isOwnerActive()
      ) {
        loadMoreInFlightRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [captureOwnerGuard, hasMoreRecords, lastRecordId, uid]);

  const loadTopicCounts = useCallback(async () => {
    const operationUid = uid;
    if (!operationUid || activeUidRef.current !== operationUid) return;
    const isOwnerActive = captureOwnerGuard(operationUid);
    const generation = ++topicCountsGenerationRef.current;

    try {
      const counts = await getPracticeCountByTopic(
        operationUid,
        isOwnerActive,
      );
      if (
        generation !== topicCountsGenerationRef.current
        || !isOwnerActive()
      ) return;
      setTopicCounts(counts);
    } catch (err) {
      if (
        generation !== topicCountsGenerationRef.current
        || !isOwnerActive()
      ) return;
      console.error("Failed to load topic counts:", err);
    }
  }, [captureOwnerGuard, uid]);

  const loadTopicScripts = useCallback(async () => {
    const operationUid = uid;
    if (!operationUid || activeUidRef.current !== operationUid) return;
    const isOwnerActive = captureOwnerGuard(operationUid);
    const generation = ++topicScriptsGenerationRef.current;

    try {
      const scripts = await getUserScripts(operationUid);
      if (
        generation !== topicScriptsGenerationRef.current
        || !isOwnerActive()
      ) return;
      setTopicScripts(scripts);
    } catch (err) {
      if (
        generation !== topicScriptsGenerationRef.current
        || !isOwnerActive()
      ) return;
      console.error("Failed to load topic scripts:", err);
    }
  }, [captureOwnerGuard, uid]);

  const saveScript = useCallback(
    async (
      topicId: string,
      script: string,
    ): Promise<{ success: boolean; message: string }> => {
      const operationUid = uid;
      if (!operationUid || activeUidRef.current !== operationUid) {
        return { success: false, message: "請先登入" };
      }
      const isOwnerActive = captureOwnerGuard(operationUid);

      try {
        await saveTopicScript(operationUid, topicId, script, isOwnerActive);

        if (isOwnerActive()) {
          // Update only the account that initiated the save. The write can
          // still finish successfully after an account switch.
          setTopicScripts((prev) => {
            const newMap = new Map(prev);
            newMap.set(topicId, script);
            return newMap;
          });
        }

        return { success: true, message: "講稿已儲存" };
      } catch (err) {
        console.error("Failed to save script:", err);
        return { success: false, message: "儲存講稿失敗" };
      }
    },
    [captureOwnerGuard, uid],
  );

  const loadScript = useCallback(
    async (topicId: string): Promise<string | null> => {
      const operationUid = uid;
      if (!operationUid || activeUidRef.current !== operationUid) return null;
      const isOwnerActive = captureOwnerGuard(operationUid);

      try {
        const script = await getTopicScript(operationUid, topicId);
        if (!isOwnerActive()) return null;
        return script?.script || null;
      } catch (err) {
        console.error("Failed to load script:", err);
        return null;
      }
    },
    [captureOwnerGuard, uid],
  );

  const saveRecord = useCallback(
    async (
      record: Omit<PracticeRecord, "id" | "createdAt" | "userId">,
      audioBlob?: Blob | null,
    ): Promise<{ success: boolean; message: string; recordId?: string }> => {
      const operationUid = uid;
      if (!operationUid || activeUidRef.current !== operationUid) {
        return { success: false, message: "請先登入" };
      }
      const isOwnerActive = captureOwnerGuard(operationUid);

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
          userId: operationUid,
        });

        // Audio is optional: the text/timing record remains valid even if the
        // crash-safe upload protocol cannot be established.
        if (audioBlob) {
          if (!isOwnerActive()) {
            return {
              success: true,
              message: "練習記錄已儲存，但錄音未能儲存",
              recordId,
            };
          }

          const operationId = newAudioOperationId();
          const path = getPracticeAudioPath(
            operationUid,
            recordId,
            audioBlob,
          );
          const cleanup: PendingPracticeAudioCleanup = {
            userId: operationUid,
            recordId,
            path,
            reason: "orphaned-upload",
            operationId,
            leaseExpiresAt: Date.now() + AUDIO_OPERATION_LEASE_MS,
          };
          let audioSaved = false;
          try {
            const lockResult = await runWithPracticeAudioOperationLock(
              cleanup,
              async () => {
                if (!isOwnerActive()) return false;
                let currentCleanup = cleanup;
                let heartbeatId: ReturnType<typeof setInterval> | undefined;
                let storageRequestInFlight = false;
                const stopHeartbeat = () => {
                  if (heartbeatId !== undefined) {
                    clearInterval(heartbeatId);
                    heartbeatId = undefined;
                  }
                };
                const persistLease = (leaseExpiresAt: number) => {
                  currentCleanup = { ...currentCleanup, leaseExpiresAt };
                  return enqueuePracticeAudioCleanup(currentCleanup);
                };

                // Hard ordering guarantee: neither the Firestore reservation
                // nor Storage upload may start without a durable marker.
                if (!enqueuePracticeAudioCleanup(currentCleanup)) {
                  console.error(
                    "Failed to persist practice audio cleanup marker",
                  );
                  return false;
                }

                activeAudioOperationIdsRef.current.add(operationId);
                heartbeatId = setInterval(() => {
                  if (
                    activeAudioOperationIdsRef.current.has(operationId)
                    && (isOwnerActive() || storageRequestInFlight)
                  ) {
                    persistLease(Date.now() + AUDIO_OPERATION_LEASE_MS);
                  }
                }, AUDIO_OPERATION_HEARTBEAT_MS);

                try {
                  await beginPracticeAudioUpload(
                    operationUid,
                    recordId,
                    path,
                    operationId,
                    isOwnerActive,
                  );
                  if (!isOwnerActive()) return false;

                  storageRequestInFlight = true;
                  let uploadedPath: string;
                  try {
                    uploadedPath = await uploadPracticeAudio(
                      operationUid,
                      recordId,
                      audioBlob,
                    );
                  } finally {
                    storageRequestInFlight = false;
                  }
                  stopHeartbeat();
                  // The Storage request is no longer live. A cleanup
                  // transaction may now safely serialize against finalize.
                  persistLease(0);
                  if (uploadedPath !== path) {
                    throw new Error("Practice audio path changed during upload.");
                  }
                  if (!isOwnerActive()) return false;

                  await completePracticeAudioUpload(
                    operationUid,
                    recordId,
                    path,
                    operationId,
                    isOwnerActive,
                  );
                  removePracticeAudioCleanup(currentCleanup);
                  return true;
                } catch (audioError) {
                  console.error("Failed to save practice audio:", audioError);
                  stopHeartbeat();
                  persistLease(0);
                  if (!isOwnerActive()) return false;

                  // The finalize Promise may have lost its ACK. Resolve the
                  // exact token transactionally before deciding whether this
                  // object is referenced, deletable, or still ambiguous.
                  let resolution: Awaited<
                    ReturnType<typeof resolvePracticeAudioCleanup>
                  > = "defer";
                  try {
                    resolution = await resolvePracticeAudioCleanup(
                      currentCleanup,
                      isOwnerActive,
                    );
                  } catch (verificationError) {
                    console.error(
                      "Failed to reconcile practice audio:",
                      verificationError,
                    );
                  }

                  if (resolution === "referenced") {
                    removePracticeAudioCleanup(currentCleanup);
                    return true;
                  }
                  if (
                    resolution === "deletable"
                    && isOwnerActive()
                  ) {
                    try {
                      await deletePracticeAudio(
                        operationUid,
                        recordId,
                        path,
                      );
                      removePracticeAudioCleanup(currentCleanup);
                    } catch (rollbackError) {
                      console.error(
                        "Failed to roll back uploaded practice audio:",
                        rollbackError,
                      );
                    }
                  }
                  return false;
                } finally {
                  stopHeartbeat();
                  activeAudioOperationIdsRef.current.delete(operationId);
                }
              },
            );
            audioSaved = lockResult.acquired && lockResult.value === true;
          } catch (lockError) {
            // Failure to establish the cross-tab critical section must not
            // broaden into an untracked Storage write.
            console.error(
              "Failed to acquire practice audio operation lock:",
              lockError,
            );
          }

          if (!audioSaved) {
            if (isOwnerActive()) {
              try {
                await loadRecords(recordsFiltersRef.current);
                await loadTopicCounts();
              } catch (reloadError) {
                console.error("Failed to reload practice records:", reloadError);
              }
            }
            return {
              success: true,
              message: "練習記錄已儲存，但錄音未能儲存",
              recordId,
            };
          }
        }

        // Reload records and counts after saving
        await loadRecords(recordsFiltersRef.current);
        await loadTopicCounts();

        return { success: true, message: "練習記錄已儲存", recordId };
      } catch (err) {
        console.error("Failed to save practice record:", err);
        return { success: false, message: "儲存練習記錄失敗" };
      }
    },
    [captureOwnerGuard, uid, loadRecords, loadTopicCounts],
  );

  const deleteRecord = useCallback(
    async (
      recordId: string,
    ): Promise<{ success: boolean; message: string }> => {
      const operationUid = uid;
      if (!operationUid || activeUidRef.current !== operationUid) {
        return { success: false, message: "請先登入" };
      }
      const isOwnerActive = captureOwnerGuard(operationUid);

      try {
        await deletePracticeRecord(recordId, operationUid, isOwnerActive);

        if (isOwnerActive()) {
          setRecords((prev) => prev.filter((r) => r.id !== recordId));
        }
        await loadTopicCounts();

        return { success: true, message: "練習記錄已刪除" };
      } catch (err) {
        console.error("Failed to delete practice record:", err);
        return { success: false, message: "刪除練習記錄失敗" };
      }
    },
    [captureOwnerGuard, uid, loadTopicCounts],
  );

  // Reset account-owned state before loading the next account. Returning only
  // state whose owner matches `uid` also prevents a one-render flash of the
  // previous account before this effect runs.
  useEffect(() => {
    recordsGenerationRef.current += 1;
    topicCountsGenerationRef.current += 1;
    topicScriptsGenerationRef.current += 1;
    loadMoreInFlightRef.current = false;
    recordsFiltersRef.current = undefined;
    setStateOwnerUid(uid);
    setRecords([]);
    setTopicCounts(new Map());
    setTopicScripts(new Map());
    setHasMoreRecords(false);
    setLastRecordId(undefined);
    setIsLoadingMore(false);
    setError(null);

    if (!uid) {
      setLoading(false);
      return undefined;
    }

    void loadRecords();
    void loadTopicCounts();
    void loadTopicScripts();

    let cancelled = false;
    const generation = ownerGenerationRef.current;
    const isOwnerActive = () => (
      !cancelled
      && mountedRef.current
      && ownerGenerationRef.current === generation
      && activeUidRef.current === uid
    );
    const retryOwnerCleanup = () => {
      if (!isOwnerActive()) return;
      void retryPracticeAudioCleanupQueue(uid, {
        resolveCleanup: (cleanup) => (
          resolvePracticeAudioCleanup(cleanup, isOwnerActive)
        ),
        isOwnerActive,
        shouldSkip: (cleanup) => (
          activeAudioOperationIdsRef.current.has(cleanup.operationId)
        ),
      });
    };
    retryOwnerCleanup();
    window.addEventListener("online", retryOwnerCleanup);
    return () => {
      cancelled = true;
      window.removeEventListener("online", retryOwnerCleanup);
    };
  }, [uid, loadRecords, loadTopicCounts, loadTopicScripts]);

  const ownsState = stateOwnerUid === uid;

  return {
    records: ownsState ? records : [],
    loading: uid ? (!ownsState || loading) : false,
    isLoadingMore: ownsState ? isLoadingMore : false,
    error: ownsState ? error : null,
    hasMoreRecords: ownsState ? hasMoreRecords : false,
    topicCounts: ownsState ? topicCounts : new Map<string, number>(),
    topicScripts: ownsState ? topicScripts : new Map<string, string>(),
    loadRecords,
    loadMoreRecords,
    saveRecord,
    deleteRecord,
    saveScript,
    loadScript,
  };
}
