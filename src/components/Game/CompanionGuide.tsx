import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface CompanionGuideProps {
  name?: string;
  tips?: string[];
  onDismiss?: () => void;
}

// Cute tips for the adventure companion
const DEFAULT_TIPS = [
  "💡 每天練習可以獲得連勝獎勵喔！",
  "✨ 收集所有精靈成為最強大師！",
  "🎯 連續答對可以獲得額外分數！",
  "📚 多複習生詞本可以提高答題正確率！",
  "💪 完成 Boss 關卡會獲得稀有精靈！",
  "🌟 升級後可以挑戰更難的關卡！",
  "🎮 按數字鍵 1-4 可以快速作答喔！",
  "💖 堅持就是勝利，加油！",
];

export function CompanionGuide({
  name = "小星星",
  tips = DEFAULT_TIPS,
  onDismiss,
}: CompanionGuideProps) {
  const [currentTip, setCurrentTip] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);

  // Rotate tips every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [tips.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed bottom-4 right-4 z-30 max-w-xs"
    >
      {/* Expanded Guide */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border-2 border-pink-200 p-4 mb-2"
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-pink-600 flex items-center gap-1">
              <span className="text-lg">✨</span>
              {name}的小提示
            </span>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-base-content/40 hover:text-base-content/60 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tip content with animation */}
          <motion.div
            key={currentTip}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="text-sm text-base-content/80 leading-relaxed"
          >
            {tips[currentTip]}
          </motion.div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1 mt-3">
            {tips.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTip(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === currentTip
                    ? "bg-pink-400 w-3"
                    : "bg-pink-200 hover:bg-pink-300"
                }`}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Companion Character */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{ y: [0, -5, 0] }}
        transition={{ y: { repeat: Infinity, duration: 2, ease: "easeInOut" } }}
        className="ml-auto block relative"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-yellow-300/30 rounded-full blur-xl animate-pulse" />

        {/* Star companion SVG */}
        <svg
          width="60"
          height="60"
          viewBox="0 0 100 100"
          className="relative z-10 drop-shadow-lg"
        >
          {/* Star body with gradient */}
          <defs>
            <radialGradient id="starGradient" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FEF3C7" />
              <stop offset="100%" stopColor="#FCD34D" />
            </radialGradient>
            <filter id="starGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Main star shape */}
          <g filter="url(#starGlow)">
            <polygon
              points="50,10 61,39 92,39 67,58 78,88 50,70 22,88 33,58 8,39 39,39"
              fill="url(#starGradient)"
              stroke="#F59E0B"
              strokeWidth="2"
            />
          </g>

          {/* Cute face */}
          <g>
            {/* Eyes */}
            <ellipse cx="40" cy="48" rx="5" ry="6" fill="#1a1a2e" />
            <ellipse cx="60" cy="48" rx="5" ry="6" fill="#1a1a2e" />
            <circle cx="42" cy="46" r="2" fill="white" />
            <circle cx="62" cy="46" r="2" fill="white" />

            {/* Cheeks */}
            <ellipse cx="30" cy="55" rx="5" ry="3" fill="#FCA5A5" opacity="0.6" />
            <ellipse cx="70" cy="55" rx="5" ry="3" fill="#FCA5A5" opacity="0.6" />

            {/* Smile */}
            <path
              d="M42 58 Q50 66 58 58"
              fill="none"
              stroke="#1a1a2e"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* Sparkles */}
          <motion.g
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <circle cx="20" cy="25" r="3" fill="#FDE68A" />
            <circle cx="80" cy="30" r="2" fill="#FDE68A" />
            <circle cx="75" cy="75" r="2.5" fill="#FDE68A" />
          </motion.g>
        </svg>

        {/* Notification badge when collapsed */}
        {!isExpanded && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center"
          >
            <span className="text-white text-xs">!</span>
          </motion.div>
        )}
      </motion.button>
    </motion.div>
  );
}

export default CompanionGuide;
