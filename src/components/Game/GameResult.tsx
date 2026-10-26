import { motion } from "framer-motion";
import type { GameStats, GameState } from "../../types/game";
import { T } from "../common/T";

interface GameResultProps {
  state: GameState;
  stats: GameStats;
  onRestart: () => void;
  onQuit: () => void;
}

export function GameResult({
  state,
  stats,
  onRestart,
  onQuit,
}: GameResultProps) {
  const isVictory = state === "victory";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="glass p-6 sm:p-8 rounded-2xl text-center max-w-sm sm:max-w-md w-full shadow-floating"
    >
      {/* Character Animation */}
      <motion.div
        animate={
          isVictory
            ? { y: [0, -10, 0], rotate: [0, 5, -5, 0] }
            : { rotate: [0, -10, 10, -10, 0] }
        }
        transition={{ repeat: Infinity, duration: isVictory ? 2 : 3 }}
        className="text-6xl sm:text-7xl mb-4"
      >
        {isVictory ? <span>🌸🦉🌟✨</span> : <span>🥺🦉💭</span>}
      </motion.div>

      <h2
        className={`text-2xl sm:text-3xl font-semibold tracking-tight mb-2 ${
          isVictory
            ? "bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
            : "text-secondary"
        }`}
      >
        <T
          k={isVictory ? "adventure.magic.victoryTitle" : "adventure.magic.defeatTitle"}
        />
      </h2>

      <p className="text-muted-foreground mb-6 text-base sm:text-lg">
        {isVictory ? (
          <>
            <T k="adventure.magic.victoryText" />✨
          </>
        ) : (
          <>
            <T k="adventure.magic.defeatText" />💖
          </>
        )}
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="surface-card p-3 sm:p-4 rounded-2xl">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">
            <T k="adventure.magic.score" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground">
            {stats.score}
          </div>
        </div>
        <div className="surface-card p-3 sm:p-4 rounded-2xl">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">
            <T k="adventure.magic.maxCombo" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-primary">
            💖 {stats.maxCombo}
          </div>
        </div>
        <div className="surface-card p-3 sm:p-4 rounded-2xl">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">
            <T k="adventure.magic.monsters" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-secondary">
            {stats.monstersDefeated}
          </div>
        </div>
        <div className="surface-card p-3 sm:p-4 rounded-2xl">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">
            <T k="adventure.magic.accuracy" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-accent">
            {stats.correctAnswers + stats.wrongAnswers > 0
              ? Math.round(
                  (stats.correctAnswers /
                    (stats.correctAnswers + stats.wrongAnswers)) *
                    100,
                )
              : 0}
            %
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRestart}
          className="w-full py-3 sm:py-4 text-lg sm:text-xl font-bold text-white bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl shadow-elevated hover:shadow-floating transition-shadow active:scale-[0.98]"
        >
          🎀 <T k="adventure.magic.playAgain" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onQuit}
          className="w-full py-3 text-base sm:text-lg font-medium text-muted-foreground hover:text-foreground hover:bg-base-200/60 rounded-2xl transition-colors"
        >
          <T k="adventure.magic.menu" />
        </motion.button>
      </div>
    </motion.div>
  );
}
