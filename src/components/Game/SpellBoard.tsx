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
            glass
            text-foreground text-lg sm:text-xl lg:text-2xl font-bold
            hover:border-primary/50 hover:shadow-floating
            transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
            flex items-center justify-center
            min-h-[70px] sm:min-h-[80px] lg:min-h-[90px]
            active:scale-[0.98]
          `}
          onClick={() => onAttack(index)}
          disabled={disabled}
        >
          {/* Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

          {/* Content */}
          <span className="relative z-10 text-center leading-tight">{def}</span>
        </motion.button>
      ))}
    </div>
  );
}
