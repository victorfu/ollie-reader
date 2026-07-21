import { motion } from "framer-motion";
import type { DailyBonusResult } from "../../services/economyService";

interface DailyBonusModalProps {
  bonus: DailyBonusResult;
  onClaim: () => void;
}

export function DailyBonusModal({ bonus, onClaim }: DailyBonusModalProps) {
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
          <motion.span
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="text-6xl"
          >
            🎁
          </motion.span>
          <h2 className="text-2xl font-semibold tracking-tight mt-2">
            每天來玩獎勵！
          </h2>
          {bonus.streakDays > 1 && (
            <div className="badge badge-error badge-lg gap-1 mt-1">
              🔥 連續登入 {bonus.streakDays} 天
            </div>
          )}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-4xl">💰</span>
            <span className="text-3xl font-bold text-warning">
              +{bonus.coins} 金幣
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClaim}
            className="btn btn-primary btn-lg w-full mt-6 active:scale-[0.98]"
          >
            開心收下！
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default DailyBonusModal;
