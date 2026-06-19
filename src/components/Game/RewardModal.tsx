import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import type { GameReward } from "../../types/game";
import {
  SPIRIT_COMPONENTS,
  RARITY_NAMES,
  ELEMENT_INFO,
} from "../../assets/spirits";
import { playSound } from "../../services/gameService";

interface RewardModalProps {
  reward: GameReward;
  onClaim: () => void;
}

export function RewardModal({ reward, onClaim }: RewardModalProps) {
  // 播放慶祝動畫和音效
  useEffect(() => {
    // 先放一波煙火
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#ffd700", "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4"],
    });

    // 如果獲得新精靈，再放一波並播放解鎖音效
    if (reward.newSpirit) {
      playSound("unlock");
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 },
          colors: ["#ffd700", "#ff69b4", "#00ff00"],
        });
      }, 500);
    }

    // 如果升級，放煙火雨並播放升級音效
    if (reward.newLevel) {
      playSound("levelup");
      const duration = 2000;
      const animationEnd = Date.now() + duration;
      const interval = setInterval(() => {
        if (Date.now() > animationEnd) {
          clearInterval(interval);
          return;
        }
        confetti({
          particleCount: 20,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: Math.random(),
            y: Math.random() - 0.2,
          },
        });
      }, 150);

      return () => clearInterval(interval);
    }
  }, [reward]);

  const SpiritComponent = reward.newSpirit
    ? SPIRIT_COMPONENTS[reward.newSpirit.id]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="card glass rounded-2xl shadow-floating w-full max-w-md overflow-hidden"
      >
        {/* 頂部裝飾 */}
        <div className="h-24 bg-gradient-to-r from-primary via-secondary to-accent relative overflow-hidden">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-6xl"
            >
              🎉
            </motion.span>
          </div>
        </div>

        <div className="card-body items-center text-center">
          {/* 標題 */}
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-semibold tracking-tight"
          >
            🏆 關卡完成！
          </motion.h2>

          {/* 經驗值獎勵 */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 mt-4"
          >
            <span className="text-4xl">⭐</span>
            <span className="text-3xl font-bold text-primary">
              +{reward.expGained} EXP
            </span>
          </motion.div>

          {/* 升級提示 */}
          {reward.newLevel && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
              className="mt-4 p-4 bg-gradient-to-r from-warning/20 to-warning/10 rounded-xl"
            >
              <span className="text-2xl">🎊</span>
              <h3 className="text-xl font-bold text-warning mt-2">升級了！</h3>
              <p className="text-lg font-medium">
                等級 {reward.newLevel - 1} → {reward.newLevel}
              </p>
            </motion.div>
          )}

          {/* 新精靈 */}
          {reward.newSpirit && SpiritComponent && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
              className="mt-4 p-6 bg-gradient-to-r from-secondary/20 to-primary/10 rounded-xl w-full"
            >
              <span className="text-xl">✨ 獲得新精靈！</span>

              <motion.div
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="my-4 flex justify-center"
              >
                <SpiritComponent size={100} animate />
              </motion.div>

              <h3 className="text-xl font-bold text-secondary">
                {reward.newSpirit.name}
              </h3>

              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="badge badge-outline">
                  {ELEMENT_INFO[reward.newSpirit.element].icon}{" "}
                  {ELEMENT_INFO[reward.newSpirit.element].name}
                </span>
                <span className="badge badge-outline">
                  {RARITY_NAMES[reward.newSpirit.rarity]}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mt-3">
                {reward.newSpirit.description}
              </p>
            </motion.div>
          )}

          {/* 最高連擊紀錄 */}
          {reward.isNewHighScore && (
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-4 badge badge-warning badge-lg gap-2"
            >
              <span>🔥</span>
              新連擊紀錄！
            </motion.div>
          )}

          {/* 確認按鈕 */}
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClaim}
            className="btn btn-primary btn-lg w-full mt-6 shadow-elevated active:scale-[0.98]"
          >
            太棒了！繼續冒險
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default RewardModal;
