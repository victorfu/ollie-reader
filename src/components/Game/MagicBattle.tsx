import { motion } from "framer-motion";
import { useMagicBattle } from "../../hooks/useMagicBattle";
import { GameLayout } from "./GameLayout";
import { BattleScene } from "./BattleScene";
import { SpellBoard } from "./SpellBoard";
import { GameResult } from "./GameResult";

export function MagicBattle() {
  const {
    gameState,
    player,
    currentMonster,
    stats,
    feedback,
    isLoading,
    progress,
    startGame,
    handleAttack,
    restartGame,
    quitGame,
  } = useMagicBattle();

  return (
    <GameLayout>
      {/* Loading Screen */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center text-foreground h-full"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="text-6xl mb-6"
          >
            🌸✨
          </motion.div>
          <p className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            正在召喚可愛怪獸...
          </p>
        </motion.div>
      )}

      {/* Menu Screen */}
      {!isLoading && gameState === "menu" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-foreground flex flex-col items-center justify-center h-full px-4"
        >
          {/* Animated Character */}
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="relative mb-6"
          >
            <div className="text-7xl sm:text-8xl lg:text-9xl relative">
              <span className="relative inline-block">
                🦉
                <motion.span
                  animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 text-3xl sm:text-4xl lg:text-5xl"
                >
                  💫
                </motion.span>
                <motion.span
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                  className="absolute -bottom-2 -left-4 sm:-bottom-4 sm:-left-6 text-2xl sm:text-3xl lg:text-4xl"
                >
                  🌟
                </motion.span>
              </span>
            </div>
            <motion.span
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -right-2 sm:-right-4 bottom-2 text-3xl sm:text-4xl"
            >
              ✨
            </motion.span>
          </motion.div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-3 bg-gradient-to-r from-primary via-secondary to-accent text-transparent bg-clip-text">
            Ollie 的魔法對決
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
            用單字魔法打敗可愛的小怪獸吧！
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="group relative px-8 py-4 sm:px-10 sm:py-5 text-xl sm:text-2xl font-bold text-white bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl shadow-floating hover:shadow-elevated transition-all duration-300 active:scale-[0.98]"
          >
            <span className="flex items-center gap-3">
              <span>🎀</span>
              <span>開始冒險</span>
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                💖
              </motion.span>
            </span>
          </motion.button>
        </motion.div>
      )}

      {/* Playing Screen */}
      {!isLoading && gameState === "playing" && (
        <div className="w-full h-full flex flex-col">
          {/* HUD - Score & Combo */}
          <div className="flex justify-between items-center px-4 py-2 sm:px-6 sm:py-3">
            <motion.div
              key={stats.score}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="glass px-4 py-2 rounded-xl shadow-elevated"
            >
              <span className="text-primary font-bold text-sm sm:text-base mr-2">
                SCORE
              </span>
              <span className="text-foreground font-mono text-xl sm:text-2xl font-bold">
                {stats.score}
              </span>
            </motion.div>

            {/* Progress Indicator */}
            <motion.div
              key={progress.current}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="glass px-4 py-2 rounded-xl shadow-elevated"
            >
              <span className="text-secondary font-bold text-sm sm:text-base">
                🌟 {progress.current}/{progress.total}
              </span>
            </motion.div>

            {stats.combo > 1 && (
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                key={stats.combo}
                className="bg-gradient-to-r from-primary to-secondary px-4 py-2 rounded-xl shadow-elevated"
              >
                <span className="text-white font-black text-lg sm:text-xl">
                  💖 {stats.combo} COMBO!
                </span>
              </motion.div>
            )}
          </div>

          {/* Battle Scene */}
          <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0 pb-4">
            <BattleScene
              player={player}
              monster={currentMonster}
              feedback={feedback}
            />
          </div>

          {/* Spell Board */}
          <div className="pb-4 pt-2">
            <SpellBoard
              monster={currentMonster}
              onAttack={handleAttack}
              disabled={feedback !== null}
            />
          </div>
        </div>
      )}

      {/* Result Screen */}
      {!isLoading && (gameState === "victory" || gameState === "defeat") && (
        <div className="flex items-center justify-center h-full px-4">
          <GameResult
            state={gameState}
            stats={stats}
            onRestart={restartGame}
            onQuit={quitGame}
          />
        </div>
      )}
    </GameLayout>
  );
}
