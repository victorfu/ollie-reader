import { motion, AnimatePresence } from "framer-motion";
import type { TravelScene, SceneTab } from "../../types/travelEnglish";
import { PhraseList } from "./PhraseList";
import { DialoguePlayer } from "./DialoguePlayer";
import { PracticeMode } from "./PracticeMode";

interface SceneDetailProps {
  scene: TravelScene;
  activeTab: SceneTab;
  onTabChange: (tab: SceneTab) => void;
  speak: (text: string) => void;
  speakAsync: (text: string) => Promise<void>;
  stopSpeaking: () => void;
}

const tabs: { value: SceneTab; label: string }[] = [
  { value: "phrases", label: "📝 片語單字" },
  { value: "dialogues", label: "💬 情境對話" },
  { value: "practice", label: "🎤 聽說練習" },
];

export const SceneDetail = ({
  scene,
  activeTab,
  onTabChange,
  speak,
  speakAsync,
  stopSpeaking,
}: SceneDetailProps) => {
  return (
    <div className="space-y-4">
      {/* Scene header */}
      <div className={`rounded-xl p-5 ${scene.colorClass}`}>
        <span className="text-4xl">{scene.emoji}</span>
        <h2 className="text-xl font-bold mt-2">{scene.title}</h2>
        <p className="text-base-content/60">{scene.titleChinese}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-base-200/50 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.value
                ? "bg-primary text-primary-content"
                : "text-base-content/60 hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            onClick={() => onTabChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "phrases" && (
            <PhraseList
              vocabulary={scene.vocabulary}
              phrases={scene.phrases}
              speak={speak}
            />
          )}
          {activeTab === "dialogues" && (
            <DialoguePlayer
              dialogues={scene.dialogues}
              speakAsync={speakAsync}
              speak={speak}
              stopSpeaking={stopSpeaking}
            />
          )}
          {activeTab === "practice" && (
            <PracticeMode
              phrases={scene.phrases}
              dialogues={scene.dialogues}
              speakAsync={speakAsync}
              speak={speak}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
