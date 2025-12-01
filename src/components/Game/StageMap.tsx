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
  const completedCount = stages.filter((_, i) => isStageCompleted(i)).length;
  const progressPercent = Math.round(
    (completedCount / (stages.length || 1)) * 100,
  );

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col">
      {/* 頂部區域 - 固定顯示 */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-base-200 via-base-200 to-transparent pb-4">
        <div className="px-4 pt-4">
          {/* 返回按鈕與標題 */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="返回"
            >
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
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">選擇關卡</h1>
              <p className="text-sm text-base-content/60">
                挑戰關卡，收集精靈！
              </p>
            </div>
            <div className="badge badge-primary badge-lg gap-1">
              <span className="text-xs">Lv.</span>
              <span className="font-bold">{progress.level}</span>
            </div>
          </div>

          {/* 進度條 */}
          <div className="bg-base-100 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">冒險進度</span>
              <span className="text-sm text-base-content/70">
                {completedCount} / {stages.length} 關卡
              </span>
            </div>
            <div className="relative h-3 bg-base-300 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-secondary rounded-full"
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-base-content/50">開始</span>
              <span className="text-xs font-medium text-primary">
                {progressPercent}%
              </span>
              <span className="text-xs text-base-content/50">完成</span>
            </div>
          </div>
        </div>
      </div>

      {/* 關卡列表 - 垂直捲動 */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <button
                  onClick={() => playable && onSelectStage(index)}
                  disabled={locked}
                  className={`
                    relative w-full text-left rounded-2xl transition-all duration-200
                    ${
                      locked
                        ? "opacity-60 cursor-not-allowed"
                        : "active:scale-[0.98]"
                    }
                    ${
                      completed
                        ? "bg-success/10 border-2 border-success/30 hover:border-success/50"
                        : ""
                    }
                    ${
                      isCurrent
                        ? "bg-primary/10 border-2 border-primary ring-2 ring-primary/20"
                        : ""
                    }
                    ${
                      playable && !completed && !isCurrent
                        ? "bg-base-100 border-2 border-base-300 hover:border-primary/50 hover:shadow-md"
                        : ""
                    }
                    ${
                      locked ? "bg-base-200/50 border-2 border-base-300/30" : ""
                    }
                  `}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* 關卡圖示 */}
                      <div
                        className={`
                          relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center
                          ${completed ? "bg-success text-success-content" : ""}
                          ${isCurrent ? "bg-primary text-primary-content" : ""}
                          ${
                            playable && !completed && !isCurrent
                              ? "bg-base-200"
                              : ""
                          }
                          ${locked ? "bg-base-300/50" : ""}
                          ${stage.isBoss ? "ring-2 ring-error/50" : ""}
                        `}
                      >
                        {completed ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-7 w-7 sm:h-8 sm:w-8"
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
                            className="h-7 w-7 sm:h-8 sm:w-8 text-base-content/30"
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
                          <span className="text-2xl sm:text-3xl">👹</span>
                        ) : (
                          <span className="text-xl sm:text-2xl font-bold">
                            {stage.stageNumber}
                          </span>
                        )}

                        {/* Boss 標籤 */}
                        {stage.isBoss && (
                          <span className="absolute -top-1 -right-1 badge badge-error badge-xs">
                            BOSS
                          </span>
                        )}
                      </div>

                      {/* 關卡資訊 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className={`font-semibold truncate ${
                              locked ? "text-base-content/40" : ""
                            }`}
                          >
                            {stage.name}
                          </h3>
                          {isCurrent && (
                            <span className="badge badge-primary badge-xs">
                              當前
                            </span>
                          )}
                        </div>

                        {/* 獎勵資訊 */}
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              locked ? "text-base-content/30" : "text-primary"
                            }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            +{stage.rewardExp} EXP
                          </span>

                          {/* 精靈獎勵預覽 */}
                          {rewardSpirit &&
                            SpiritComponent &&
                            !completed &&
                            !locked && (
                              <span className="inline-flex items-center gap-1 text-base-content/60">
                                <div className="w-5 h-5">
                                  <SpiritComponent size={20} animate={false} />
                                </div>
                                <span className="text-xs">
                                  {rewardSpirit.name}
                                </span>
                              </span>
                            )}
                        </div>

                        {/* 等級需求 */}
                        {locked && stage.requiredLevel > progress.level && (
                          <div className="mt-1 text-xs text-error flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            需要 Lv.{stage.requiredLevel} 解鎖
                          </div>
                        )}
                      </div>

                      {/* 右側箭頭 */}
                      {playable && (
                        <div className="shrink-0 self-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 ${
                              isCurrent
                                ? "text-primary"
                                : "text-base-content/30"
                            }`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 當前關卡的脈動效果 */}
                  {isCurrent && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-2xl border-2 border-primary pointer-events-none"
                    />
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 底部提示 - 固定顯示 */}
      <div className="sticky bottom-0 bg-gradient-to-t from-base-200 via-base-200 to-transparent pt-4 pb-4 px-4">
        <div className="text-center">
          <p className="text-sm text-base-content/50">
            👆 點擊可遊玩的關卡開始挑戰
          </p>
        </div>
      </div>
    </div>
  );
}

export default StageMap;
