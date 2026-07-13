import { useState } from "react";
import { motion } from "framer-motion";
import {
  SPIRIT_COMPONENTS,
  RARITY_NAMES,
  getSpiritById,
} from "../../assets/spirits";
import { GACHA_POOL } from "../../constants/gachaPool";
import {
  GACHA_COST,
  canAffordGacha,
  type GachaResult,
} from "../../services/economyService";
import { GachaResultModal } from "./GachaResultModal";

interface ShopProps {
  coins: number;
  onDraw: () => Promise<GachaResult | null>;
  onBack: () => void;
}

export function Shop({ coins, onDraw, onBack }: ShopProps) {
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<GachaResult | null>(null);
  const canAfford = canAffordGacha(coins);
  const totalWeight = GACHA_POOL.reduce((s, e) => s + e.weight, 0);

  const handleDraw = async () => {
    if (drawing || !canAfford) return;
    setDrawing(true);
    const r = await onDraw();
    setDrawing(false);
    if (r) setResult(r);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center p-4 sm:p-6">
      {/* 頂部：返回 + 金幣 */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="btn btn-ghost btn-sm gap-1 active:scale-[0.98]"
        >
          ← 回主選單
        </button>
        <span className="badge badge-warning badge-lg gap-1">
          🪙 {coins}
        </span>
      </div>

      {/* 扭蛋機 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card glass rounded-2xl shadow-floating w-full max-w-md text-center"
      >
        <div className="card-body items-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            🛒 神秘扭蛋機
          </h1>
          <p className="text-sm text-muted-foreground">
            用金幣抽可愛的限定精靈！重複的話會換成金幣退還喔～
          </p>

          <motion.div
            animate={{ rotate: drawing ? [0, -8, 8, -8, 8, 0] : 0 }}
            transition={{ duration: 0.6, repeat: drawing ? Infinity : 0 }}
            className="text-7xl my-4"
          >
            🥚
          </motion.div>

          <motion.button
            whileHover={canAfford ? { scale: 1.03 } : {}}
            whileTap={canAfford ? { scale: 0.97 } : {}}
            onClick={handleDraw}
            disabled={!canAfford || drawing}
            className="btn btn-primary btn-lg w-full gap-2 disabled:opacity-50 active:scale-[0.98]"
          >
            {drawing ? "轉呀轉…" : `抽一次（🪙 ${GACHA_COST}）`}
          </motion.button>
          {!canAfford && (
            <p className="text-xs text-error mt-1">
              金幣不夠囉！去闖關賺金幣吧 💪
            </p>
          )}
        </div>
      </motion.div>

      {/* 可能出現的精靈 */}
      <div className="w-full max-w-md mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          可能抽到的精靈
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GACHA_POOL.map((entry) => {
            const spirit = getSpiritById(entry.id);
            const SpiritComponent = SPIRIT_COMPONENTS[entry.id];
            const percent = Math.round((entry.weight / totalWeight) * 100);
            return (
              <div
                key={entry.id}
                className="surface-card rounded-xl p-2 flex flex-col items-center text-center"
              >
                {SpiritComponent ? (
                  <SpiritComponent size={56} animate={false} />
                ) : (
                  <span className="text-3xl">❓</span>
                )}
                <span className="text-xs font-medium mt-1">
                  {spirit?.name ?? "??"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {RARITY_NAMES[entry.rarity]} · {percent}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {result && (
        <GachaResultModal result={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}

export default Shop;
