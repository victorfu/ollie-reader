import { motion, AnimatePresence } from "framer-motion";
import { X, Star } from "lucide-react";
import { travelScenes } from "../../data/travelScenes";
import type { useTravelProgress } from "../../hooks/useTravelProgress";

interface PassportModalProps {
  open: boolean;
  onClose: () => void;
  travelProgress: ReturnType<typeof useTravelProgress>;
}

export function PassportModal({ open, onClose, travelProgress }: PassportModalProps) {
  const { getSceneProgress, getStampCount } = travelProgress;
  const stamps = getStampCount();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-base-100/95 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-[16px] shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto pointer-events-auto">
              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">🛂 我的旅行護照</h2>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-circle min-h-[44px]"
                    onClick={onClose}
                    aria-label="關閉"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Passport cover */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[12px] p-5 text-white mb-5">
                  <p className="text-center text-sm font-semibold tracking-wider mb-1">
                    TRAVEL PASSPORT
                  </p>
                  <p className="text-center text-xs opacity-80 mb-4">旅行護照</p>
                  <div className="space-y-1.5 text-sm">
                    <p>
                      <span className="opacity-70">Name:</span> Little Explorer
                    </p>
                    <p>
                      <span className="opacity-70">From:</span> Taiwan 🇹🇼
                    </p>
                    <p>
                      <span className="opacity-70">To:</span> Singapore 🇸🇬
                    </p>
                    <p className="pt-2 font-medium">
                      Stamps: {stamps.earned} / {stamps.total}
                    </p>
                  </div>
                </div>

                {/* Stamps grid */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    📋 護照印章 <span className="text-xs font-normal text-base-content/50">Stamps</span>
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {travelScenes.map((scene) => {
                      const sp = getSceneProgress(scene.id);
                      const earned = sp.stampEarned;

                      return (
                        <div
                          key={scene.id}
                          className={`flex flex-col items-center justify-center p-2 rounded-[10px] border min-h-[70px] transition-all ${
                            earned
                              ? "border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10"
                              : "border-black/5 dark:border-white/10 bg-base-200/30"
                          }`}
                        >
                          <span
                            className={`text-2xl ${earned ? "" : "opacity-20 grayscale"}`}
                          >
                            {scene.emoji}
                          </span>
                          {earned ? (
                            <div className="flex gap-0.5 mt-1">
                              {[1, 2, 3].map((n) => (
                                <Star
                                  key={n}
                                  className={`w-2.5 h-2.5 ${
                                    n <= sp.challengeStars
                                      ? "text-amber-400 fill-amber-400"
                                      : "text-base-content/20"
                                  }`}
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-base-content/30 mt-1">🔒</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Close button */}
                <button
                  type="button"
                  className="btn btn-outline w-full mt-5 min-h-[44px]"
                  onClick={onClose}
                >
                  關閉
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
