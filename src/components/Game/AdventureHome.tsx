import { motion } from "framer-motion";
import { SPIRIT_COMPONENTS } from "../../assets/spirits";
import type { PlayerProgress } from "../../types/game";
import { LEVEL_EXP_TABLE } from "../../services/gameProgressService";

interface AdventureHomeProps {
  progress: PlayerProgress;
  onStartAdventure: () => void;
  onOpenCollection: () => void;
}

export function AdventureHome({
  progress,
  onStartAdventure,
  onOpenCollection,
}: AdventureHomeProps) {
  // 計算經驗條百分比
  const currentLevelExp = LEVEL_EXP_TABLE[progress.level - 1] || 0;
  const nextLevelExp = LEVEL_EXP_TABLE[progress.level] || progress.exp;
  const expInCurrentLevel = progress.exp - currentLevelExp;
  const expNeededForLevel = nextLevelExp - currentLevelExp;
  const expPercentage = Math.min(
    (expInCurrentLevel / expNeededForLevel) * 100,
    100,
  );

  // 取得隨機已解鎖的精靈來展示
  const displaySpiritIds = progress.unlockedSpiritIds.slice(0, 3);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-4">
      {/* 背景裝飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* 主卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-base-100 shadow-xl w-full max-w-md"
      >
        <div className="card-body items-center text-center">
          {/* 標題 */}
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            ✨ 精靈探險 ✨
          </h1>
          <p className="text-base-content/70 text-sm">
            收集單字精靈，成為最強的語言大師！
          </p>

          {/* 玩家資訊 */}
          <div className="w-full mt-4 p-4 bg-base-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">等級 {progress.level}</span>
              <span className="text-xs text-base-content/60">
                {expInCurrentLevel} / {expNeededForLevel} EXP
              </span>
            </div>

            {/* 經驗條 */}
            <div className="w-full bg-base-300 rounded-full h-3 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${expPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            {/* 統計數據 */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="p-2 bg-base-100 rounded-lg">
                <div className="text-lg font-bold text-primary">
                  {progress.unlockedSpiritIds.length}
                </div>
                <div className="text-xs text-base-content/60">精靈</div>
              </div>
              <div className="p-2 bg-base-100 rounded-lg">
                <div className="text-lg font-bold text-secondary">
                  {progress.totalQuizCompleted}
                </div>
                <div className="text-xs text-base-content/60">通關</div>
              </div>
              <div className="p-2 bg-base-100 rounded-lg">
                <div className="text-lg font-bold text-accent">
                  {progress.highestCombo}
                </div>
                <div className="text-xs text-base-content/60">最高連擊</div>
              </div>
            </div>
          </div>

          {/* 精靈展示 */}
          {displaySpiritIds.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {displaySpiritIds.map((spiritId, index) => {
                const SpiritComponent = SPIRIT_COMPONENTS[spiritId];
                if (!SpiritComponent) return null;

                return (
                  <motion.div
                    key={spiritId}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    <SpiritComponent size={60} animate />
                  </motion.div>
                );
              })}
              {progress.unlockedSpiritIds.length > 3 && (
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center text-sm font-medium text-base-content/60">
                  +{progress.unlockedSpiritIds.length - 3}
                </div>
              )}
            </div>
          )}

          {/* 按鈕區 */}
          <div className="card-actions w-full mt-6 flex-col gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStartAdventure}
              className="btn btn-primary btn-lg w-full gap-2"
            >
              <span className="text-xl">🗺️</span>
              開始冒險
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onOpenCollection}
              className="btn btn-outline btn-secondary w-full gap-2"
            >
              <span className="text-xl">📖</span>
              精靈圖鑑
              <span className="badge badge-secondary badge-sm">
                {progress.unlockedSpiritIds.length}/10
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* 提示文字 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-sm text-base-content/50 mt-6"
      >
        💡 完成關卡可獲得經驗值和新精靈！
      </motion.p>
    </div>
  );
}

export default AdventureHome;
