import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useSpeechState } from "../../hooks/useSpeechState";
import type { SceneTab } from "../../types/travelEnglish";
import { sceneSections, travelScenes } from "../../data/travelScenes";
import { SceneCard } from "./SceneCard";
import { SceneDetail } from "./SceneDetail";
import { logger } from "../../utils/logger";

export const TravelEnglishPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SceneTab>("phrases");
  const { speak, speakAsync, stopSpeaking } = useSpeechState();

  const sceneId = searchParams.get("scene");
  const selectedScene = useMemo(
    () => travelScenes.find((s) => s.id === sceneId) ?? null,
    [sceneId],
  );

  // Reset tab when scene changes (including browser back/forward)
  useEffect(() => {
    setActiveTab("phrases");
  }, [sceneId]);

  // Clear invalid scene IDs from the URL
  useEffect(() => {
    if (sceneId && !selectedScene) {
      logger.warn(`Invalid travel scene ID: "${sceneId}"`);
      setSearchParams({}, { replace: true });
    }
  }, [sceneId, selectedScene, setSearchParams]);

  const handleSelect = (id: string) => {
    setSearchParams({ scene: id });
  };

  const handleBack = () => {
    setSearchParams({});
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
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
            <p className="text-base-content/60 mt-1 mb-6">
              選擇一個場景，學習旅遊英文吧！
            </p>

            <div className="space-y-8">
              {sceneSections.map((section) => (
                <section key={section.id}>
                  <h2 className="flex items-center gap-2 text-base font-semibold mb-3">
                    <span className="text-xl">{section.emoji}</span>
                    <span>{section.titleChinese}</span>
                    <span className="text-sm text-base-content/40 font-normal">
                      {section.title}
                    </span>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {section.scenes.map((scene) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        onSelect={() => handleSelect(scene.id)}
                      />
                    ))}
                  </div>
                </section>
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
