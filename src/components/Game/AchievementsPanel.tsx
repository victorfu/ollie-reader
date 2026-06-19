import { motion } from "framer-motion";
import type { PlayerProgress } from "../../types/game";
import {
  ACHIEVEMENTS,
  RARITY_STYLES,
  type Achievement,
} from "../../constants/achievements";

interface AchievementBadgeProps {
  achievement: Achievement;
  isUnlocked: boolean;
  animate?: boolean;
}

export function AchievementBadge({
  achievement,
  isUnlocked,
  animate = true,
}: AchievementBadgeProps) {
  const style = RARITY_STYLES[achievement.rarity];

  return (
    <motion.div
      initial={animate ? { opacity: 0, scale: 0.8 } : false}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={isUnlocked ? { scale: 1.05 } : {}}
      className={`
        relative p-3 rounded-xl border-2 transition-all
        ${isUnlocked ? `bg-gradient-to-br ${style.bg} ${style.border} shadow-elevated ${style.glow}` : "bg-base-200/50 border-border-hairline opacity-60"}
      `}
    >
      {/* Icon */}
      <div className="text-center">
        <span
          className={`text-3xl ${!isUnlocked ? "grayscale opacity-50" : ""}`}
        >
          {isUnlocked ? achievement.icon : "🔒"}
        </span>
      </div>

      {/* Name */}
      <h4
        className={`text-sm font-bold text-center mt-1 ${isUnlocked ? style.text : "text-base-content/50"}`}
      >
        {isUnlocked ? achievement.name : "???"}
      </h4>

      {/* Description on hover */}
      {isUnlocked && (
        <p className="text-xs text-center text-muted-foreground mt-1">
          {achievement.description}
        </p>
      )}

      {/* Rarity indicator */}
      {isUnlocked && achievement.rarity === "rainbow" && (
        <motion.div
          className="absolute -top-1 -right-1 text-sm"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          ✨
        </motion.div>
      )}
    </motion.div>
  );
}

interface AchievementsPanelProps {
  progress: PlayerProgress;
  onClose: () => void;
}

export function AchievementsPanel({
  progress,
  onClose,
}: AchievementsPanelProps) {
  const unlockedCount = ACHIEVEMENTS.filter((a) =>
    a.requirement(progress),
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="glass rounded-2xl shadow-floating w-full max-w-lg max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-border-hairline flex items-center justify-between bg-gradient-to-r from-primary/10 to-secondary/10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <span>🏅</span>
              成就徽章
            </h2>
            <p className="text-sm text-muted-foreground">
              已解鎖 {unlockedCount}/{ACHIEVEMENTS.length}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle active:scale-[0.98]">
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2 bg-base-200/40">
          <div className="w-full bg-base-300 rounded-full h-2">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Achievement Grid */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((achievement, index) => (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                isUnlocked={achievement.requirement(progress)}
                animate={index < 6}
              />
            ))}
          </div>
        </div>

        {/* Footer tip */}
        <div className="p-4 border-t border-border-hairline text-center">
          <p className="text-sm text-muted-foreground">
            💡 繼續冒險解鎖更多成就！
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default AchievementsPanel;
