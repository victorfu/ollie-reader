import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  SPIRIT_COMPONENTS,
  RARITY_NAMES,
  ELEMENT_INFO,
  getSpiritById,
} from "../../assets/spirits";
import { playSound } from "../../services/gameService";
import type { GachaResult } from "../../services/economyService";

interface GachaResultModalProps {
  result: GachaResult;
  onClose: () => void;
}

export function GachaResultModal({ result, onClose }: GachaResultModalProps) {
  const spirit = getSpiritById(result.spiritId);
  const SpiritComponent = SPIRIT_COMPONENTS[result.spiritId];

  useEffect(() => {
    if (result.isDuplicate) {
      playSound("click");
    } else {
      playSound("unlock");
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#f9a8d4", "#c4b5fd", "#fcd34d", "#fbcfe8"],
      });
    }
  }, [result]);

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
        className="card glass rounded-2xl shadow-floating w-full max-w-sm text-center"
      >
        <div className="card-body items-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            {result.isDuplicate ? "又見面囉！" : "✨ 抽到新精靈！"}
          </h2>

          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.15 }}
            className="my-4"
          >
            {SpiritComponent ? (
              <SpiritComponent size={120} animate />
            ) : (
              <span className="text-6xl">❓</span>
            )}
          </motion.div>

          <h3 className="text-xl font-bold text-secondary">
            {spirit?.name ?? "神秘精靈"}
          </h3>
          {spirit && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="badge badge-outline">
                {ELEMENT_INFO[spirit.element].icon}{" "}
                {ELEMENT_INFO[spirit.element].name}
              </span>
              <span className="badge badge-outline">
                {RARITY_NAMES[spirit.rarity]}
              </span>
            </div>
          )}

          {result.isDuplicate && (
            <div className="mt-4 p-3 bg-warning/15 rounded-xl">
              <span className="font-medium text-warning">
                已經有囉！換成 {result.refundCoins} 金幣 🪙
              </span>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="btn btn-primary btn-lg w-full mt-6 active:scale-[0.98]"
          >
            太好了！
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default GachaResultModal;
