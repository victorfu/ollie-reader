import { motion } from "framer-motion";
import type { Monster } from "../../types/game";

interface SpellBoardProps {
  monster: Monster | null;
  onAttack: (index: number) => void;
  disabled: boolean;
}

export function SpellBoard({ monster, onAttack, disabled }: SpellBoardProps) {
  if (!monster) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 w-full max-w-3xl mx-auto px-4">
      {monster.definitions.map((def, index) => (
        <motion.button
          key={`${monster.id}-${index}`}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08 }}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className={`
            relative overflow-hidden group
            p-4 sm:p-5 lg:p-6 rounded-2xl
            bg-gradient-to-br from-white/90 to-pink-50/90
            backdrop-blur-xl
            border-2 border-pink-200
            text-slate-700 text-lg sm:text-xl lg:text-2xl font-bold
            shadow-[0_4px_20px_rgba(236,72,153,0.15)]
            hover:border-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.3)]
            hover:from-white hover:to-pink-100/90
            transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:border-pink-200
            flex items-center justify-center
            min-h-[70px] sm:min-h-[80px] lg:min-h-[90px]
          `}
          onClick={() => onAttack(index)}
          disabled={disabled}
        >
          {/* Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-200/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

          {/* Content */}
          <span className="relative z-10 text-center leading-tight">{def}</span>
        </motion.button>
      ))}
    </div>
  );
}
