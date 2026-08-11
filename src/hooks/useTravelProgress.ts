import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import {
  completeTravelMission,
  getOrCreateTravelProgress,
  markTravelMissionInProgress,
  saveTravelMissionCompletion,
  saveTravelMissionStep,
  type TravelProgress,
} from "../services/travelProgressService";
import type { TravelMissionStepKind } from "../components/TravelEnglish/travelMissionUtils";

export function useTravelProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<TravelProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeUidRef = useRef<string | null>(user?.uid ?? null);
  const progressRef = useRef<TravelProgress | null>(null);
  const loadSequenceRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const loadPromisesRef = useRef(
    new Map<string, Promise<TravelProgress>>(),
  );
  const mutationQueuesRef = useRef(new Map<string, Promise<void>>());

  activeUidRef.current = user?.uid ?? null;

  const getProgressPromise = useCallback((uid: string) => {
    const existing = loadPromisesRef.current.get(uid);
    if (existing) return existing;

    const created = getOrCreateTravelProgress(uid).finally(() => {
      if (loadPromisesRef.current.get(uid) === created) {
        loadPromisesRef.current.delete(uid);
      }
    });
    loadPromisesRef.current.set(uid, created);
    return created;
  }, []);

  const loadProgress = useCallback(async () => {
    const uid = user?.uid ?? null;
    const sequence = ++loadSequenceRef.current;
    const mutationVersion = mutationVersionRef.current;
    if (!uid) {
      progressRef.current = null;
      setProgress(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextProgress = await getProgressPromise(uid);
      if (
        activeUidRef.current !== uid ||
        loadSequenceRef.current !== sequence ||
        mutationVersionRef.current !== mutationVersion
      ) {
        return;
      }
      progressRef.current = nextProgress;
      setProgress(nextProgress);
    } catch (err) {
      if (
        activeUidRef.current !== uid ||
        loadSequenceRef.current !== sequence
      ) {
        return;
      }
      console.error("Failed to load travel progress:", err);
      setError("無法同步旅遊任務進度");
    } finally {
      if (
        activeUidRef.current === uid &&
        loadSequenceRef.current === sequence
      ) {
        setIsLoading(false);
      }
    }
  }, [getProgressPromise, user?.uid]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const updateProgress = useCallback(
    (
      updater: (current: TravelProgress) => TravelProgress,
      persist: (uid: string) => Promise<void>,
    ) => {
      const uid = user?.uid;
      if (!uid) return;

      const runMutation = async () => {
        if (activeUidRef.current !== uid) return;

        let baseProgress =
          progressRef.current?.uid === uid ? progressRef.current : null;
        if (!baseProgress) {
          try {
            baseProgress = await getProgressPromise(uid);
          } catch (err) {
            if (activeUidRef.current !== uid) return;
            console.error("Failed to load travel progress before update:", err);
            setError("無法同步旅遊任務進度，請稍後再試");
            return;
          }
        }

        if (activeUidRef.current !== uid) return;
        const nextProgress = updater(baseProgress);
        mutationVersionRef.current += 1;
        progressRef.current = nextProgress;
        setProgress(nextProgress);

        try {
          await persist(uid);
        } catch (err) {
          console.error("Failed to save travel progress:", err);
          if (activeUidRef.current === uid) {
            setError("任務已完成，但目前無法同步到帳號");
          }
        }
      };

      const previous = mutationQueuesRef.current.get(uid) ?? Promise.resolve();
      const queued = previous.then(runMutation, runMutation).finally(() => {
        if (mutationQueuesRef.current.get(uid) === queued) {
          mutationQueuesRef.current.delete(uid);
        }
      });
      mutationQueuesRef.current.set(uid, queued);
    },
    [getProgressPromise, user?.uid],
  );

  const markStep = useCallback(
    (topicId: string, step: TravelMissionStepKind) => {
      const now = Date.now();
      updateProgress(
        (current) => markTravelMissionInProgress(current, topicId, step, now),
        (uid) => saveTravelMissionStep(uid, topicId, step, now),
      );
    },
    [updateProgress],
  );

  const completeMission = useCallback(
    (topicId: string) => {
      const now = Date.now();
      updateProgress(
        (current) => completeTravelMission(current, topicId, now),
        (uid) => saveTravelMissionCompletion(uid, topicId, now),
      );
    },
    [updateProgress],
  );

  return {
    progress: progress?.uid === (user?.uid ?? null) ? progress : null,
    isLoading,
    error,
    reload: loadProgress,
    markStep,
    completeMission,
  };
}
