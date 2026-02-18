import { motion } from "framer-motion";
import type { TravelScene } from "../../types/travelEnglish";

interface SceneCardProps {
  scene: TravelScene;
  onSelect: () => void;
}

export const SceneCard = ({ scene, onSelect }: SceneCardProps) => {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="group flex items-center gap-3 w-full text-left bg-base-100 rounded-lg border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-3"
      onClick={onSelect}
    >
      {/* Emoji badge with scene color */}
      <span
        className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-2xl ${scene.colorClass}`}
      >
        {scene.emoji}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold leading-tight truncate">
          {scene.title}
        </h3>
        <p className="text-xs text-base-content/60 mt-0.5 truncate">
          {scene.titleChinese} · {scene.vocabulary.length} 單字 ·{" "}
          {scene.phrases.length} 句型
        </p>
      </div>

      {/* Hover chevron */}
      <svg
        className="flex-shrink-0 w-4 h-4 text-base-content/20 group-hover:text-base-content/40 transition-colors"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </motion.button>
  );
};
