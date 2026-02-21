import { motion } from "framer-motion";
import { BookOpen, Star } from "lucide-react";
import { sceneSections } from "../../data/travelScenes";
import { PassportModal } from "./PassportModal";
import type { useTravelProgress } from "../../hooks/useTravelProgress";

interface JourneyMapProps {
  onSelectScene: (id: string) => void;
  travelProgress: ReturnType<typeof useTravelProgress>;
  passportOpen: boolean;
  setPassportOpen: (open: boolean) => void;
}

export function JourneyMap({ onSelectScene, travelProgress, passportOpen, setPassportOpen }: JourneyMapProps) {
  const { getOverallProgress, getStampCount, getSceneStars } = travelProgress;
  const overall = getOverallProgress();
  const stamps = getStampCount();

  return (
    <>
      {/* Sticky Header */}
      <div className="sticky top-14 z-20 bg-base-100/90 backdrop-blur-md border-b border-black/5 dark:border-white/10 -mx-2 px-4 py-3 sm:-mx-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            🌏 新加坡冒險
          </h1>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1.5 min-h-[44px]"
            onClick={() => setPassportOpen(true)}
            aria-label="打開護照"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-sm font-medium">🛂 {stamps.earned}/{stamps.total}</span>
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-base-content/50 mb-1">
            <span>探索進度</span>
            <span>{overall.percentage}%</span>
          </div>
          <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overall.percentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8 mt-6 pb-8">
        {sceneSections.map((section) => (
          <section key={section.id}>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
              <span className="text-xl">{section.emoji}</span>
              <span>{section.titleChinese}</span>
              <span className="text-sm text-base-content/40 font-normal">
                {section.title}
              </span>
            </h2>

            {/* Journey nodes - zigzag on mobile, grid on desktop */}
            <div className="space-y-3 lg:grid lg:grid-cols-4 lg:gap-3 lg:space-y-0">
              {section.scenes.map((scene, index) => {
                const stars = getSceneStars(scene.id);
                const isCompleted = stars > 0;

                return (
                  <motion.button
                    key={scene.id}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className={`group w-full text-left rounded-[10px] border shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 ${
                      isCompleted
                        ? "border-amber-300/50 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-500/20"
                        : "border-black/5 dark:border-white/10 bg-base-100"
                    } ${index % 2 === 1 ? "lg:transform-none ml-auto mr-0 sm:ml-auto sm:mr-0 lg:ml-0" : "mr-auto ml-0 lg:mr-0"}`}
                    style={{ maxWidth: "85%" }}
                    onClick={() => onSelectScene(scene.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex-shrink-0 w-12 h-12 rounded-[10px] flex items-center justify-center text-2xl ${scene.colorClass}`}
                      >
                        {scene.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold leading-tight truncate">
                          {scene.title}
                        </h3>
                        <p className="text-xs text-base-content/60 mt-0.5 truncate">
                          {scene.titleChinese}
                        </p>
                        {/* Stars */}
                        <div className="flex gap-0.5 mt-1">
                          {[1, 2, 3].map((n) => (
                            <Star
                              key={n}
                              className={`w-3.5 h-3.5 ${
                                n <= stars
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-base-content/20"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Passport Modal */}
      <PassportModal
        open={passportOpen}
        onClose={() => setPassportOpen(false)}
        travelProgress={travelProgress}
      />
    </>
  );
}
