import { motion } from "framer-motion";
import {
  SPIRITS,
  SPIRIT_COMPONENTS,
  RARITY_COLORS,
  RARITY_NAMES,
  ELEMENT_INFO,
} from "../../assets/spirits";
import type { PlayerProgress } from "../../types/game";

interface SpiritCollectionProps {
  progress: PlayerProgress;
  onBack: () => void;
}

export function SpiritCollection({ progress, onBack }: SpiritCollectionProps) {
  const unlockedCount = progress.unlockedSpiritIds.length;
  const totalCount = SPIRITS.length;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col p-4 sm:p-6">
      {/* 頂部導航 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="btn btn-ghost btn-sm gap-2 active:scale-[0.98]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          返回
        </button>

        <div className="text-right">
          <h2 className="text-lg font-semibold tracking-tight">精靈圖鑑</h2>
          <p className="text-sm text-muted-foreground">
            已收集 {unlockedCount}/{totalCount}
          </p>
        </div>
      </div>

      {/* 收集進度條 */}
      <div className="w-full bg-base-300 rounded-full h-3 mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* 精靈網格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {SPIRITS.map((spirit, index) => {
          const isUnlocked = progress.unlockedSpiritIds.includes(spirit.id);
          const SpiritComponent = SPIRIT_COMPONENTS[spirit.id];
          const rarityStyle = RARITY_COLORS[spirit.rarity];
          const elementInfo = ELEMENT_INFO[spirit.element];

          return (
            <motion.div
              key={spirit.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`
                card surface-card rounded-2xl overflow-hidden
                ${isUnlocked ? "" : "opacity-60"}
              `}
            >
              <div
                className={`
                relative p-4 flex flex-col items-center
                ${isUnlocked ? rarityStyle.bg : "bg-base-200"}
              `}
              >
                {/* 稀有度標籤 */}
                <div className="absolute top-2 left-2">
                  <span
                    className={`
                    badge badge-sm
                    ${isUnlocked ? rarityStyle.text : "badge-ghost"}
                  `}
                  >
                    {RARITY_NAMES[spirit.rarity]}
                  </span>
                </div>

                {/* 元素標籤 */}
                <div className="absolute top-2 right-2">
                  <span className="text-lg" title={elementInfo.name}>
                    {elementInfo.icon}
                  </span>
                </div>

                {/* 精靈圖示 */}
                <div
                  className={`
                  relative w-20 h-20 flex items-center justify-center
                  ${!isUnlocked ? "grayscale" : ""}
                `}
                >
                  {SpiritComponent ? (
                    <SpiritComponent size={80} animate={isUnlocked} />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center">
                      <span className="text-3xl">❓</span>
                    </div>
                  )}

                  {/* 未解鎖遮罩 */}
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-base-content/20 backdrop-blur-sm flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8 text-base-content/50"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* 精靈名稱 */}
                <h3
                  className={`
                  mt-2 text-sm font-bold text-center
                  ${isUnlocked ? "" : "text-base-content/50"}
                `}
                >
                  {isUnlocked ? spirit.name : "???"}
                </h3>

                {/* 可進化提示 */}
                {isUnlocked &&
                  spirit.evolvesToId &&
                  !progress.evolvedSpiritIds.includes(spirit.id) && (
                    <span className="mt-1 badge badge-xs badge-accent gap-1">
                      ✨ 可進化
                    </span>
                  )}
              </div>

              {/* 精靈描述 */}
              {isUnlocked && (
                <div className="p-3 border-t border-border-hairline">
                  <p className="text-xs text-muted-foreground text-center line-clamp-2">
                    {spirit.description}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 底部提示 */}
      {unlockedCount < totalCount && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-muted-foreground">
            🎮 完成更多關卡來解鎖新的精靈！
          </p>
        </motion.div>
      )}

      {/* 全收集獎勵 */}
      {unlockedCount === totalCount && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 p-6 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl text-center"
        >
          <span className="text-4xl mb-2 block">🏆</span>
          <h3 className="text-lg font-semibold text-primary">
            恭喜！全精靈收集完成！
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            你已成為真正的語言大師！
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default SpiritCollection;
