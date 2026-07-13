import { motion } from "framer-motion";

interface BossHpBarProps {
  hp: number;
  maxHp: number;
}

export function BossHpBar({ hp, maxHp }: BossHpBarProps) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-between text-xs font-bold mb-1">
        <span className="text-error">魔王 HP</span>
        <span className="text-muted-foreground">
          {hp} / {maxHp}
        </span>
      </div>
      <div className="w-full bg-base-300 rounded-full h-4 overflow-hidden border border-error/30">
        <motion.div
          className="h-full bg-gradient-to-r from-error via-warning to-error rounded-full"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default BossHpBar;
