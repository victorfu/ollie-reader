import { useState } from "react";
import { motion } from "framer-motion";
import type { DefLanguage, PlayerProgress } from "../../types/game";
import { LEVEL_EXP_TABLE } from "../../services/gameProgressService";
import { COIN_REWARDS } from "../../services/economyService";
import { getGameTabTargetName } from "../../utils/gameTabs";
import { AchievementsPanel } from "./AchievementsPanel";
import { ACHIEVEMENTS } from "../../constants/achievements";

interface AdventureHomeProps {
  progress: PlayerProgress;
  defLanguage: DefLanguage;
  onChangeDefLanguage: (lang: DefLanguage) => void;
  onStartAdventure: () => void;
}

const DEF_LANGUAGE_OPTIONS: { value: DefLanguage; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "英文" },
];

export function AdventureHome({
  progress,
  defLanguage,
  onChangeDefLanguage,
  onStartAdventure,
}: AdventureHomeProps) {
  const [showAchievements, setShowAchievements] = useState(false);

  // 計算經驗條百分比
  const currentLevelExp = LEVEL_EXP_TABLE[progress.level - 1] || 0;
  const nextLevelExp = LEVEL_EXP_TABLE[progress.level] || progress.exp;
  const expInCurrentLevel = progress.exp - currentLevelExp;
  const expNeededForLevel = nextLevelExp - currentLevelExp;
  const expPercentage = Math.min(
    (expInCurrentLevel / expNeededForLevel) * 100,
    100,
  );

  // 計算已解鎖成就數量
  const unlockedAchievements = ACHIEVEMENTS.filter((a) =>
    a.requirement(progress),
  ).length;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* 成就面板 */}
      {showAchievements && (
        <AchievementsPanel
          progress={progress}
          onClose={() => setShowAchievements(false)}
        />
      )}

      {/* 背景裝飾 - 增強可愛風格 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-warning/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/3 w-24 h-24 bg-accent/10 rounded-full blur-2xl animate-pulse" />

        {/* 飄動的可愛裝飾 */}
        {["🌸", "✨", "💫", "🌟", "💖", "🎀"].map((emoji, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl opacity-30"
            style={{
              top: `${15 + i * 15}%`,
              left: `${10 + i * 15}%`,
            }}
            animate={{
              y: [-10, 10, -10],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>

      {/* 主卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-card rounded-2xl w-full max-w-md"
      >
        <div className="card-body items-center text-center">
          {/* 標題 */}
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            ✨ 單字大冒險 ✨
          </h1>
          <p className="text-muted-foreground text-sm">
            闖關答題賺扭蛋代幣，去扭蛋機收集人氣角色！
          </p>

          {/* 玩家資訊 */}
          <div className="w-full mt-4 p-4 bg-base-200/60 rounded-xl border border-border-hairline">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">等級 {progress.level}</span>
              <span className="text-xs text-muted-foreground">
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

            {/* 扭蛋代幣與連勝 */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="badge badge-soft badge-warning gap-1 font-semibold">
                🪙 {progress.coins} 代幣
              </span>
              {progress.streakDays > 0 && (
                <span className="badge badge-soft badge-error gap-1 font-semibold">
                  🔥 連續 {progress.streakDays} 天
                </span>
              )}
            </div>

            {/* 統計數據 */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="p-2 bg-base-100/70 rounded-lg border border-border-hairline">
                <div className="text-lg font-bold text-primary">
                  {progress.totalBossDefeated}
                </div>
                <div className="text-xs text-muted-foreground">擊敗魔王</div>
              </div>
              <div className="p-2 bg-base-100/70 rounded-lg border border-border-hairline">
                <div className="text-lg font-bold text-secondary">
                  {progress.totalQuizCompleted}
                </div>
                <div className="text-xs text-muted-foreground">通關</div>
              </div>
              <div className="p-2 bg-base-100/70 rounded-lg border border-border-hairline">
                <div className="text-lg font-bold text-accent">
                  {progress.highestCombo}
                </div>
                <div className="text-xs text-muted-foreground">最高連擊</div>
              </div>
            </div>
          </div>

          {/* 釋義語言 */}
          <div className="w-full mt-4 p-3 bg-base-200/60 rounded-xl border border-border-hairline">
            <div className="flex items-center justify-between gap-3">
              <span
                id="def-language-label"
                className="text-sm font-medium shrink-0"
              >
                釋義語言
              </span>
              <div
                role="group"
                aria-labelledby="def-language-label"
                className="flex gap-1 p-1 bg-base-300/60 rounded-[8px]"
              >
                {DEF_LANGUAGE_OPTIONS.map(({ value, label }) => {
                  const active = defLanguage === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChangeDefLanguage(value)}
                      className={`inline-flex min-h-11 items-center gap-1 rounded-[6px] px-3 text-sm font-medium transition-all active:scale-[0.98] ${
                        active
                          ? "bg-accent text-white shadow-sm"
                          : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                    >
                      {label}
                      {value === "en" && (
                        <span className="text-xs font-semibold">
                          🪙×{COIN_REWARDS.englishModeMultiplier}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {defLanguage === "en"
                ? `只看英文解釋，比較難，代幣 ${COIN_REWARDS.englishModeMultiplier} 倍！`
                : "看中文解釋。想挑戰英英解釋可以切到英文，代幣加倍。"}
            </p>
          </div>

          {/* 按鈕區 */}
          <div className="card-actions w-full mt-6 flex-col gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStartAdventure}
              className="btn btn-primary btn-lg w-full gap-2 shadow-elevated active:scale-[0.98]"
            >
              <span className="text-xl">🗺️</span>
              開始冒險
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAchievements(true)}
              className="btn btn-outline btn-accent w-full gap-1"
            >
              <span className="text-lg">🏅</span>
              成就
              <span className="badge badge-accent badge-xs">
                {unlockedAchievements}/{ACHIEVEMENTS.length}
              </span>
            </motion.button>

            <a
              href="/games/gacha"
              target={getGameTabTargetName("/games/gacha")}
              className="btn btn-soft btn-warning w-full gap-2 hover:text-white"
            >
              <span className="text-lg">🎀</span>
              去扭蛋機收集人氣角色
            </a>
          </div>
        </div>
      </motion.div>

      {/* 提示文字 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-sm text-muted-foreground mt-6"
      >
        💡 完成關卡可獲得經驗值和扭蛋代幣，代幣可拿去抽人氣角色！
      </motion.p>
    </div>
  );
}

export default AdventureHome;
