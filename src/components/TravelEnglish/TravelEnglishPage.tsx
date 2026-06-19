import { useMemo, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useSpeechState } from "../../hooks/useSpeechState";
import { useTravelProgress } from "../../hooks/useTravelProgress";
import type { ActivityType } from "../../types/travelEnglish";
import { travelScenes } from "../../data/travelScenes";
import { JourneyMap } from "./JourneyMap";
import { SceneHub } from "./SceneHub";
import { WordExplorer } from "./WordExplorer";
import { StoryMode } from "./StoryMode";
import { RolePlayMode } from "./RolePlayMode";
import { ChallengeMode } from "./ChallengeMode";
import { logger } from "../../utils/logger";

const pageVariants = {
  enter: { x: 30, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -30, opacity: 0 },
};

export const TravelEnglishPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { speak, speakAsync, stopSpeaking } = useSpeechState();
  const travelProgress = useTravelProgress();
  const [passportOpen, setPassportOpen] = useState(false);

  const sceneId = searchParams.get("scene");
  const activity = searchParams.get("activity") as ActivityType | null;

  const selectedScene = useMemo(
    () => travelScenes.find((s) => s.id === sceneId) ?? null,
    [sceneId],
  );

  useEffect(() => {
    if (sceneId && !selectedScene) {
      logger.warn(`Invalid travel scene ID: "${sceneId}"`);
      setSearchParams({}, { replace: true });
    }
  }, [sceneId, selectedScene, setSearchParams]);

  const navigateTo = (scene?: string, act?: string) => {
    const params: Record<string, string> = {};
    if (scene) params.scene = scene;
    if (act) params.activity = act;
    setSearchParams(params);
  };

  const handleBack = () => {
    if (activity) {
      navigateTo(sceneId ?? undefined);
    } else {
      navigateTo();
    }
  };

  const renderContent = () => {
    // No scene → Journey Map
    if (!selectedScene) {
      return (
        <motion.div
          key="journey-map"
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <JourneyMap
            onSelectScene={(id) => navigateTo(id)}
            travelProgress={travelProgress}
            passportOpen={passportOpen}
            setPassportOpen={setPassportOpen}
          />
        </motion.div>
      );
    }

    // Scene selected but no activity → Scene Hub
    if (!activity) {
      return (
        <motion.div
          key={`hub-${selectedScene.id}`}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <SceneHub
            scene={selectedScene}
            onBack={handleBack}
            onSelectActivity={(act) => navigateTo(selectedScene.id, act)}
            travelProgress={travelProgress}
          />
        </motion.div>
      );
    }

    // Activity selected
    return (
      <motion.div
        key={`${selectedScene.id}-${activity}`}
        variants={pageVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {activity === "words" && (
          <WordExplorer
            scene={selectedScene}
            onBack={handleBack}
            speak={speak}
            travelProgress={travelProgress}
          />
        )}
        {activity === "story" && (
          <StoryMode
            scene={selectedScene}
            onBack={handleBack}
            speak={speak}
            speakAsync={speakAsync}
            stopSpeaking={stopSpeaking}
            travelProgress={travelProgress}
          />
        )}
        {activity === "roleplay" && (
          <RolePlayMode
            scene={selectedScene}
            onBack={handleBack}
            speak={speak}
            travelProgress={travelProgress}
          />
        )}
        {activity === "challenge" && (
          <ChallengeMode
            scene={selectedScene}
            onBack={handleBack}
            speak={speak}
            travelProgress={travelProgress}
          />
        )}
      </motion.div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </div>
  );
};
