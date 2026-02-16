import { motion } from "framer-motion";
import type { TravelScene } from "../../types/travelEnglish";

interface SceneCardProps {
  scene: TravelScene;
  onSelect: () => void;
}

export const SceneCard = ({ scene, onSelect }: SceneCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-base-100 rounded-xl border border-black/5 dark:border-white/10 shadow-sm hover:shadow-lg transition-shadow cursor-pointer p-4"
      onClick={onSelect}
    >
      <span className="text-3xl">{scene.emoji}</span>
      <h3 className="font-semibold mt-2">{scene.title}</h3>
      <p className="text-sm text-base-content/60">{scene.titleChinese}</p>
      <p className="text-sm mt-1 line-clamp-2">{scene.description}</p>
      <p className="text-xs text-base-content/50 mt-2">
        {scene.vocabulary.length} 單字 · {scene.phrases.length} 句型
      </p>
    </motion.div>
  );
};
