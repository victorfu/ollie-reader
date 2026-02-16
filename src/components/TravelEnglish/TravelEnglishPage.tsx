import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSpeechState } from "../../hooks/useSpeechState";
import type { TravelScene, SceneTab } from "../../types/travelEnglish";
import { travelScenes } from "../../data/travelScenes";
import { SceneCard } from "./SceneCard";
import { SceneDetail } from "./SceneDetail";

export const TravelEnglishPage = () => {
  const [selectedScene, setSelectedScene] = useState<TravelScene | null>(null);
  const [activeTab, setActiveTab] = useState<SceneTab>("phrases");
  const { speak, speakAsync, stopSpeaking } = useSpeechState();

  const handleBack = () => {
    setSelectedScene(null);
    setActiveTab("phrases");
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <AnimatePresence mode="wait">
        {selectedScene === null ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-2xl font-bold">🌏 新加坡旅遊英文</h1>
            <p className="text-base-content/60 mt-1 mb-4">
              選擇一個場景，學習旅遊英文吧！
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {travelScenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  onSelect={() => setSelectedScene(scene)}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={selectedScene.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm mb-3"
              onClick={handleBack}
            >
              ← 返回
            </button>
            <SceneDetail
              scene={selectedScene}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              speak={speak}
              speakAsync={speakAsync}
              stopSpeaking={stopSpeaking}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
