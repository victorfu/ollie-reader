import { motion } from "framer-motion";
import type { Stage, PlayerProgress } from "../../types/game";
import { SPIRIT_COMPONENTS, getSpiritById } from "../../assets/spirits";

interface StageMapProps {
  stages: Stage[];
  progress: PlayerProgress;
  isStageCompleted: (stageIndex: number) => boolean;
  isStagePlayable: (stageIndex: number) => boolean;
  onSelectStage: (stageIndex: number) => void;
  onBack: () => void;
}

export function StageMap({
  stages,
  progress,
  isStageCompleted,
  isStagePlayable,
  onSelectStage,
  onBack,
}: StageMapProps) {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col p-4">
      {/* 頂部導航 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="btn btn-ghost btn-sm gap-2">
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

        <div className="flex items-center gap-2">
          <span className="badge badge-primary badge-lg">
            Lv.{progress.level}
          </span>
          <span className="text-sm text-base-content/70">
            關卡 {progress.currentStageIndex + 1}/{stages.length}
          </span>
        </div>
      </div>

      {/* 關卡地圖 */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex items-center gap-4 min-w-max px-4">
          {stages.map((stage, index) => {
            const completed = isStageCompleted(index);
            const playable = isStagePlayable(index);
            const locked = !playable && !completed;
            const isCurrent = index === progress.currentStageIndex;

            // 獲取關卡獎勵精靈
            const rewardSpirit = stage.rewardSpiritId
              ? getSpiritById(stage.rewardSpiritId)
              : null;
            const SpiritComponent = stage.rewardSpiritId
              ? SPIRIT_COMPONENTS[stage.rewardSpiritId]
              : null;

            return (
              <div key={stage.id} className="flex items-center">
                {/* 關卡節點 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  <button
                    onClick={() => playable && onSelectStage(index)}
                    disabled={locked}
                    className={`
                      relative flex flex-col items-center p-4 rounded-2xl transition-all
                      ${
                        completed ? "bg-success/20 border-2 border-success" : ""
                      }
                      ${
                        isCurrent
                          ? "bg-primary/20 border-2 border-primary ring-4 ring-primary/20"
                          : ""
                      }
                      ${
                        playable && !completed && !isCurrent
                          ? "bg-base-200 border-2 border-base-300 hover:border-primary hover:bg-primary/10"
                          : ""
                      }
                      ${
                        locked
                          ? "bg-base-200/50 border-2 border-base-300/50 opacity-50 cursor-not-allowed"
                          : ""
                      }
                      ${stage.isBoss ? "min-w-[140px]" : "min-w-[120px]"}
                    `}
                  >
                    {/* Boss 標籤 */}
                    {stage.isBoss && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <span className="badge badge-error badge-sm">BOSS</span>
                      </div>
                    )}

                    {/* 關卡圖示 */}
                    <div
                      className={`
                      w-16 h-16 rounded-full flex items-center justify-center mb-2
                      ${completed ? "bg-success text-success-content" : ""}
                      ${isCurrent ? "bg-primary text-primary-content" : ""}
                      ${
                        playable && !completed && !isCurrent
                          ? "bg-base-300"
                          : ""
                      }
                      ${locked ? "bg-base-300/50" : ""}
                      ${stage.isBoss ? "ring-2 ring-error/50" : ""}
                    `}
                    >
                      {completed ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : locked ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8 text-base-content/30"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : stage.isBoss ? (
                        <span className="text-3xl">👹</span>
                      ) : (
                        <span className="text-2xl font-bold">
                          {stage.stageNumber}
                        </span>
                      )}
                    </div>

                    {/* 關卡名稱 */}
                    <span
                      className={`text-sm font-medium text-center ${
                        locked ? "text-base-content/30" : ""
                      }`}
                    >
                      {stage.name}
                    </span>

                    {/* 獎勵預覽 */}
                    {rewardSpirit &&
                      SpiritComponent &&
                      !completed &&
                      !locked && (
                        <div className="mt-2 flex items-center gap-1">
                          <div className="w-8 h-8 opacity-70">
                            <SpiritComponent size={32} animate={false} />
                          </div>
                          <span className="text-xs text-base-content/50">
                            可獲得
                          </span>
                        </div>
                      )}

                    {/* 經驗值獎勵 */}
                    <div
                      className={`mt-1 text-xs ${
                        locked ? "text-base-content/30" : "text-primary"
                      }`}
                    >
                      +{stage.rewardExp} EXP
                    </div>

                    {/* 等級需求 */}
                    {locked && stage.requiredLevel > progress.level && (
                      <div className="mt-1 text-xs text-error">
                        需要 Lv.{stage.requiredLevel}
                      </div>
                    )}
                  </button>

                  {/* 當前關卡指示器 */}
                  {isCurrent && (
                    <motion.div
                      animate={{ y: [-5, 5, -5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-primary"
                    >
                      ▲
                    </motion.div>
                  )}
                </motion.div>

                {/* 連接線 */}
                {index < stages.length - 1 && (
                  <div
                    className={`
                    w-8 h-1 mx-2 rounded-full
                    ${isStageCompleted(index) ? "bg-success" : "bg-base-300"}
                  `}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="text-center mt-4">
        <p className="text-sm text-base-content/50">
          👆 點擊可遊玩的關卡開始挑戰
        </p>
      </div>
    </div>
  );
}

export default StageMap;
