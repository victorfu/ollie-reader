import { useState, useCallback } from "react";
import type { ActivityType } from "../types/travelEnglish";
import { travelScenes } from "../data/travelScenes";

const STORAGE_KEY = "travel-progress";

interface SceneProgress {
  wordsLearned: string[];
  storiesWatched: string[];
  rolePlayScore: number | null;
  challengeStars: number;
  stampEarned: boolean;
}

interface TravelProgress {
  scenes: Record<string, SceneProgress>;
}

const defaultSceneProgress: SceneProgress = {
  wordsLearned: [],
  storiesWatched: [],
  rolePlayScore: null,
  challengeStars: 0,
  stampEarned: false,
};

function loadProgress(): TravelProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TravelProgress;
  } catch { /* ignore */ }
  return { scenes: {} };
}

function saveProgress(progress: TravelProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function useTravelProgress() {
  const [progress, setProgress] = useState<TravelProgress>(loadProgress);

  const update = useCallback((updater: (prev: TravelProgress) => TravelProgress) => {
    setProgress((prev) => {
      const next = updater(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const getSceneProgress = useCallback(
    (sceneId: string): SceneProgress =>
      progress.scenes[sceneId] ?? defaultSceneProgress,
    [progress],
  );

  const markWordLearned = useCallback(
    (sceneId: string, word: string) => {
      update((prev) => {
        const sp = prev.scenes[sceneId] ?? { ...defaultSceneProgress };
        if (sp.wordsLearned.includes(word)) return prev;
        return {
          scenes: {
            ...prev.scenes,
            [sceneId]: { ...sp, wordsLearned: [...sp.wordsLearned, word] },
          },
        };
      });
    },
    [update],
  );

  const markStoryWatched = useCallback(
    (sceneId: string, dialogueId: string) => {
      update((prev) => {
        const sp = prev.scenes[sceneId] ?? { ...defaultSceneProgress };
        if (sp.storiesWatched.includes(dialogueId)) return prev;
        return {
          scenes: {
            ...prev.scenes,
            [sceneId]: { ...sp, storiesWatched: [...sp.storiesWatched, dialogueId] },
          },
        };
      });
    },
    [update],
  );

  const setRolePlayScore = useCallback(
    (sceneId: string, score: number) => {
      update((prev) => {
        const sp = prev.scenes[sceneId] ?? { ...defaultSceneProgress };
        const best = sp.rolePlayScore === null ? score : Math.max(sp.rolePlayScore, score);
        return {
          scenes: {
            ...prev.scenes,
            [sceneId]: { ...sp, rolePlayScore: best },
          },
        };
      });
    },
    [update],
  );

  const setChallengeStars = useCallback(
    (sceneId: string, stars: number) => {
      update((prev) => {
        const sp = prev.scenes[sceneId] ?? { ...defaultSceneProgress };
        const best = Math.max(sp.challengeStars, stars);
        const stampEarned = best > 0;
        return {
          scenes: {
            ...prev.scenes,
            [sceneId]: { ...sp, challengeStars: best, stampEarned },
          },
        };
      });
    },
    [update],
  );

  const isActivityUnlocked = useCallback(
    (sceneId: string, activity: ActivityType, scene: { vocabulary: { word: string }[]; dialogues: { id: string }[] }): boolean => {
      if (activity === "words" || activity === "story") return true;
      const sp = getSceneProgress(sceneId);
      if (activity === "roleplay") {
        return sp.wordsLearned.length >= scene.vocabulary.length;
      }
      if (activity === "challenge") {
        return sp.storiesWatched.length > 0;
      }
      return false;
    },
    [getSceneProgress],
  );

  const getOverallProgress = useCallback(() => {
    const totalScenes = travelScenes.length;
    const totalStars = totalScenes * 3;
    let earned = 0;
    for (const scene of travelScenes) {
      const sp = progress.scenes[scene.id];
      if (sp) earned += sp.challengeStars;
    }
    return { earned, total: totalStars, percentage: totalStars > 0 ? Math.round((earned / totalStars) * 100) : 0 };
  }, [progress]);

  const getStampCount = useCallback(() => {
    const totalScenes = travelScenes.length;
    let earned = 0;
    for (const scene of travelScenes) {
      const sp = progress.scenes[scene.id];
      if (sp?.stampEarned) earned++;
    }
    return { earned, total: totalScenes };
  }, [progress]);

  const getSceneStars = useCallback(
    (sceneId: string): number => {
      return progress.scenes[sceneId]?.challengeStars ?? 0;
    },
    [progress],
  );

  return {
    progress,
    getSceneProgress,
    markWordLearned,
    markStoryWatched,
    setRolePlayScore,
    setChallengeStars,
    isActivityUnlocked,
    getOverallProgress,
    getStampCount,
    getSceneStars,
  };
}
