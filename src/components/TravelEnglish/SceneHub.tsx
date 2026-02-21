import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Check, Play } from "lucide-react";
import type { TravelScene, ActivityType } from "../../types/travelEnglish";
import type { useTravelProgress } from "../../hooks/useTravelProgress";

interface SceneHubProps {
  scene: TravelScene;
  onBack: () => void;
  onSelectActivity: (activity: ActivityType) => void;
  travelProgress: ReturnType<typeof useTravelProgress>;
}

const activities: {
  type: ActivityType;
  emoji: string;
  labelCn: string;
  labelEn: string;
}[] = [
  { type: "words", emoji: "🔤", labelCn: "探索單字", labelEn: "Explore Words" },
  { type: "story", emoji: "📖", labelCn: "看故事", labelEn: "Story" },
  { type: "roleplay", emoji: "🎭", labelCn: "角色扮演", labelEn: "Role Play" },
  { type: "challenge", emoji: "⭐", labelCn: "挑戰", labelEn: "Challenge" },
];

export function SceneHub({ scene, onBack, onSelectActivity, travelProgress }: SceneHubProps) {
  const { getSceneProgress, isActivityUnlocked } = travelProgress;
  const sp = getSceneProgress(scene.id);
  const [funFactIndex, setFunFactIndex] = useState(0);

  // Rotate fun facts
  useEffect(() => {
    if (!scene.funFacts || scene.funFacts.length <= 1) return;
    const timer = setInterval(() => {
      setFunFactIndex((i) => (i + 1) % scene.funFacts!.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [scene.funFacts]);

  const getActivityStatus = (type: ActivityType) => {
    const unlocked = isActivityUnlocked(scene.id, type, scene);
    if (!unlocked) return "locked" as const;

    switch (type) {
      case "words":
        if (sp.wordsLearned.length >= scene.vocabulary.length) return "completed" as const;
        if (sp.wordsLearned.length > 0) return "in-progress" as const;
        return "not-started" as const;
      case "story":
        if (sp.storiesWatched.length >= scene.dialogues.length) return "completed" as const;
        if (sp.storiesWatched.length > 0) return "in-progress" as const;
        return "not-started" as const;
      case "roleplay":
        if (sp.rolePlayScore !== null) return "completed" as const;
        return "not-started" as const;
      case "challenge":
        if (sp.challengeStars > 0) return "completed" as const;
        return "not-started" as const;
    }
  };

  const funFact = scene.funFacts?.[funFactIndex];

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        type="button"
        className="btn btn-ghost btn-sm gap-1.5 min-h-[44px]"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4" />
        返回地圖
      </button>

      {/* Scene Hero Card */}
      <div
        className={`rounded-[12px] p-5 border border-black/5 dark:border-white/10 backdrop-blur-xl ${scene.colorClass}`}
      >
        <span className="text-5xl">{scene.emoji}</span>
        <h2 className="text-xl font-bold mt-3">{scene.title}</h2>
        <p className="text-base-content/60 text-sm">{scene.titleChinese}</p>
        <p className="text-base-content/70 text-sm mt-2">{scene.description}</p>

        {funFact && (
          <motion.div
            key={funFactIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-white/50 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5"
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">{funFact.emoji}</span>
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-0.5">
                  💡 Did you know?
                </p>
                <p className="text-sm">{funFact.english}</p>
                <p className="text-xs text-base-content/50 mt-0.5">{funFact.chinese}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Activity Grid */}
      <div>
        <h3 className="text-base font-semibold mb-3">
          🎯 你的任務 <span className="text-sm font-normal text-base-content/50">Your Missions</span>
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {activities.map((act) => {
            const status = getActivityStatus(act.type);
            const isLocked = status === "locked";

            return (
              <motion.button
                key={act.type}
                type="button"
                whileHover={isLocked ? {} : { scale: 1.02 }}
                whileTap={isLocked ? {} : { scale: 0.98 }}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-[12px] border shadow-sm text-center min-h-[120px] justify-center transition-all ${
                  isLocked
                    ? "opacity-60 grayscale cursor-not-allowed border-black/5 dark:border-white/10 bg-base-200/50"
                    : "cursor-pointer border-black/5 dark:border-white/10 bg-base-100/70 backdrop-blur-sm hover:shadow-md"
                }`}
                onClick={() => !isLocked && onSelectActivity(act.type)}
                disabled={isLocked}
              >
                <span className="text-3xl">{act.emoji}</span>
                <div>
                  <p className="text-sm font-semibold">{act.labelCn}</p>
                  <p className="text-xs text-base-content/50">{act.labelEn}</p>
                </div>
                {/* Status badge */}
                <div className="mt-1">
                  {status === "locked" && (
                    <span className="inline-flex items-center gap-1 text-xs text-base-content/40">
                      <Lock className="w-3 h-3" /> 未解鎖
                    </span>
                  )}
                  {status === "not-started" && (
                    <span className="text-xs text-base-content/40">☆ 未開始</span>
                  )}
                  {status === "in-progress" && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                      <Play className="w-3 h-3" /> 進行中
                    </span>
                  )}
                  {status === "completed" && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-500">
                      <Check className="w-3 h-3" /> 完成
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
