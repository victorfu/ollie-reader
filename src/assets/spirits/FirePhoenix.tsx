import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 火焰鳳凰 - 傳說中的火屬性精靈（傳說級）
export function FirePhoenix({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const flameAnimation = animate
    ? {
        y: [0, -3, 0],
        scale: [1, 1.02, 1],
        transition: {
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      }
    : {};

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      animate={flameAnimation}
    >
      <defs>
        <radialGradient id="phoenixBody" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFD43B" />
          <stop offset="50%" stopColor="#FF6B35" />
          <stop offset="100%" stopColor="#E03131" />
        </radialGradient>
        <radialGradient id="phoenixWing" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FF922B" />
          <stop offset="100%" stopColor="#E03131" />
        </radialGradient>
        <radialGradient id="phoenixGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE066" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 光暈 */}
      <circle cx="50" cy="50" r="45" fill="url(#phoenixGlow)" />

      {/* 陰影 */}
      <ellipse cx="50" cy="92" rx="20" ry="4" fill="#00000022" />

      {/* 尾巴火焰 */}
      <path
        d="M40 75 Q30 90 35 95 Q42 85 45 90 Q48 80 50 85 Q55 75 55 80 Q60 70 50 75 Z"
        fill="url(#phoenixWing)"
      />
      <path
        d="M42 78 Q35 88 38 92 Q43 84 46 87"
        fill="none"
        stroke="#FFD43B"
        strokeWidth="2"
      />

      {/* 翅膀 - 左 */}
      <path
        d="M25 40 Q5 35 8 50 Q12 45 15 50 Q18 42 22 48 Q25 40 30 45 Q28 38 25 40"
        fill="url(#phoenixWing)"
      />
      <path
        d="M10 48 Q15 44 18 47"
        fill="none"
        stroke="#FFD43B"
        strokeWidth="1.5"
      />

      {/* 翅膀 - 右 */}
      <path
        d="M75 40 Q95 35 92 50 Q88 45 85 50 Q82 42 78 48 Q75 40 70 45 Q72 38 75 40"
        fill="url(#phoenixWing)"
      />
      <path
        d="M90 48 Q85 44 82 47"
        fill="none"
        stroke="#FFD43B"
        strokeWidth="1.5"
      />

      {/* 身體 */}
      <ellipse cx="50" cy="55" rx="22" ry="25" fill="url(#phoenixBody)" />

      {/* 胸部羽毛 */}
      <path
        d="M38 50 Q42 58 38 66 Q45 62 50 66 Q55 62 62 66 Q58 58 62 50 Q50 55 38 50"
        fill="#FFD43B"
      />

      {/* 頭 */}
      <circle cx="50" cy="30" r="16" fill="url(#phoenixBody)" />

      {/* 頭冠火焰 */}
      <path
        d="M40 20 Q38 8 42 12 Q44 5 50 10 Q56 5 58 12 Q62 8 60 20"
        fill="#FFD43B"
      />
      <path d="M44 18 Q45 10 50 14 Q55 10 56 18" fill="#FF922B" />

      {/* 眼睛 */}
      <ellipse cx="44" cy="28" rx="4" ry="5" fill="white" />
      <ellipse cx="56" cy="28" rx="4" ry="5" fill="white" />
      <circle cx="45" cy="29" r="2.5" fill="#E03131" />
      <circle cx="57" cy="29" r="2.5" fill="#E03131" />
      <circle cx="46" cy="27" r="1" fill="white" />
      <circle cx="58" cy="27" r="1" fill="white" />

      {/* 喙 */}
      <path d="M47 34 L50 40 L53 34 Z" fill="#FF6B35" />
      <path
        d="M48 35 L50 38 L52 35"
        fill="none"
        stroke="#E03131"
        strokeWidth="1"
      />

      {/* 腳 */}
      <path
        d="M42 78 L40 85 L38 82 M40 85 L42 82 M40 85 L40 82"
        stroke="#FF6B35"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58 78 L60 85 L58 82 M60 85 L62 82 M60 85 L60 82"
        stroke="#FF6B35"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 火花裝飾 */}
      <circle cx="18" cy="55" r="2" fill="#FFD43B" />
      <circle cx="82" cy="55" r="2" fill="#FFD43B" />
      <circle cx="25" cy="70" r="1.5" fill="#FF922B" />
      <circle cx="75" cy="70" r="1.5" fill="#FF922B" />
    </motion.svg>
  );
}

export default FirePhoenix;
