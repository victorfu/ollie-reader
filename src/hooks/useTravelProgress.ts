import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  completeTravelMission,
  createDefaultTravelProgress,
  getOrCreateTravelProgress,
  markTravelMissionInProgress,
  saveTravelProgress,
  type TravelProgress,
} from "../services/travelProgressService";
import type { TravelMissionStepKind } from "../components/TravelEnglish/travelMissionUtils";

export function useTravelProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<TravelProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    if (!user) {
      setProgress(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextProgress = await getOrCreateTravelProgress(user.uid);
      setProgress(nextProgress);
    } catch (err) {
      console.error("Failed to load travel progress:", err);
      setError("無法同步旅遊任務進度");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const updateProgress = useCallback(
    (updater: (current: TravelProgress) => TravelProgress) => {
      if (!user) return;

      setProgress((current) => {
        const baseProgress = current ?? createDefaultTravelProgress(user.uid);
        const nextProgress = updater(baseProgress);

        saveTravelProgress(nextProgress).catch((err) => {
          console.error("Failed to save travel progress:", err);
          setError("任務已完成，但目前無法同步到帳號");
        });

        return nextProgress;
      });
    },
    [user],
  );

  const markStep = useCallback(
    (topicId: string, step: TravelMissionStepKind) => {
      updateProgress((current) =>
        markTravelMissionInProgress(current, topicId, step),
      );
    },
    [updateProgress],
  );

  const completeMission = useCallback(
    (topicId: string) => {
      updateProgress((current) => completeTravelMission(current, topicId));
    },
    [updateProgress],
  );

  return {
    progress,
    isLoading,
    error,
    reload: loadProgress,
    markStep,
    completeMission,
  };
}
