import { motion, AnimatePresence } from "framer-motion";
import type { Monster, Player } from "../../types/game";

interface BattleSceneProps {
  player: Player;
  monster: Monster | null;
  feedback: "hit" | "damage" | "miss" | null;
}

export function BattleScene({ player, monster, feedback }: BattleSceneProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center h-full w-full px-4 sm:px-8 lg:px-16 relative gap-2 sm:gap-0">
      {/* Player (Ollie) */}
      <div className="flex flex-col items-center gap-1 sm:gap-2 relative order-2 sm:order-1">
        {/* Player HP - Heart Style */}
        <div className="flex gap-1 mb-1 sm:mb-2">
          {[...Array(player.maxHp)].map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 1 }}
              animate={
                i < player.hp
                  ? { scale: [1, 1.2, 1] }
                  : { scale: 1, opacity: 0.3 }
              }
              transition={{ duration: 0.3 }}
              className="text-2xl sm:text-4xl"
            >
              {i < player.hp ? "💖" : "🤍"}
            </motion.span>
          ))}
        </div>

        {/* Cute Wizard Ollie */}
        <motion.div
          animate={
            feedback === "damage"
              ? { x: [-8, 8, -8, 8, 0], rotate: [0, -5, 5, -5, 0] }
              : { y: [0, -8, 0] }
          }
          transition={
            feedback === "damage"
              ? { duration: 0.5 }
              : { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
          }
          className="relative"
        >
          {/* Wizard Container */}
          <div className="relative w-24 h-24 sm:w-36 sm:h-36 lg:w-44 lg:h-44">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-pink-300/40 to-purple-300/40 rounded-full blur-2xl animate-pulse" />

            {/* Main Character */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              {/* Sparkle above */}
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-xl sm:text-2xl lg:text-3xl -mb-1"
              >
                ✨
              </motion.div>
              {/* Face */}
              <div className="text-4xl sm:text-6xl lg:text-7xl">🦉</div>
            </div>

            {/* Magic Sparkles */}
            <motion.div
              animate={{ rotate: [0, 15, 0, -15, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute -right-1 bottom-3 sm:-right-4 sm:bottom-6 text-2xl sm:text-3xl lg:text-4xl"
            >
              🌟
              <motion.span
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute -top-3 -right-1 sm:-top-4 sm:-right-2 text-lg sm:text-xl"
              >
                💫
              </motion.span>
            </motion.div>
          </div>

          {/* Damage Effect */}
          {feedback === "damage" && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -60, scale: 1.5 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-3xl sm:text-5xl font-black text-pink-500"
              style={{ textShadow: "2px 2px 0 #fff, -2px -2px 0 #fff" }}
            >
              💫
            </motion.div>
          )}
        </motion.div>

        {/* Name Tag */}
        <div className="text-slate-700 font-bold text-sm sm:text-lg bg-gradient-to-r from-pink-200/90 to-purple-200/90 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full backdrop-blur-md border border-pink-300/50 shadow-lg">
          ✨ {player.name}
        </div>
      </div>

      {/* VS Badge (Hidden on mobile) */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="hidden sm:flex text-pink-300/50 text-4xl lg:text-6xl font-black absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      >
        ⭐
      </motion.div>

      {/* Monster */}
      <AnimatePresence mode="wait">
        {monster && (
          <motion.div
            key={monster.id}
            initial={{ opacity: 0, x: 30, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0, rotate: 360 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="flex flex-col items-center gap-1 sm:gap-2 relative order-1 sm:order-2"
          >
            {/* Monster Word Bubble */}
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="bg-gradient-to-br from-white to-pink-50 text-slate-800 px-4 py-2 sm:px-6 sm:py-4 rounded-2xl shadow-[0_8px_30px_rgba(236,72,153,0.2)] border-4 border-pink-300 text-center relative"
            >
              <h3 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-wide">
                {monster.word}
              </h3>
              {/* Speech Bubble Tail */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent border-t-pink-300"></div>
            </motion.div>

            {/* Monster Character */}
            <motion.div
              animate={
                feedback === "hit"
                  ? { x: [-10, 10, -10, 10, 0], scale: [1, 0.8, 1] }
                  : { y: [0, -8, 0], rotate: [0, 3, 0, -3, 0] }
              }
              transition={
                feedback === "hit"
                  ? { duration: 0.4 }
                  : { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
              }
              className="relative"
            >
              <div className="w-24 h-24 sm:w-36 sm:h-36 lg:w-44 lg:h-44 flex items-center justify-center">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-pink-300/30 to-purple-300/30 rounded-full blur-2xl" />

                {/* Monster Emoji */}
                <span className="text-6xl sm:text-8xl lg:text-9xl relative z-10 filter drop-shadow-lg">
                  {monster.emoji}
                </span>
              </div>

              {/* Hit Effect */}
              {feedback === "hit" && (
                <motion.div
                  initial={{ opacity: 1, scale: 0.5 }}
                  animate={{ opacity: 0, scale: 3 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="text-5xl sm:text-7xl">✨</span>
                </motion.div>
              )}
            </motion.div>

            {/* Monster Name Tag */}
            <div className="text-slate-700 font-bold text-sm sm:text-lg bg-gradient-to-r from-pink-200/90 to-purple-200/90 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full backdrop-blur-md border border-pink-300/50 shadow-lg">
              {monster.name}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
