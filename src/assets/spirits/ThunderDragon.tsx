import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 雷龍 - 傳說中的電屬性精靈（傳說級）
export function ThunderDragon({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const electricAnimation = animate
    ? {
        filter: [
          "drop-shadow(0 0 8px #FFE066)",
          "drop-shadow(0 0 15px #FFE066)",
          "drop-shadow(0 0 8px #FFE066)",
        ],
        transition: {
          duration: 0.8,
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
      animate={electricAnimation}
    >
      <defs>
        <radialGradient id="thunderDragonBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#9775FA" />
          <stop offset="100%" stopColor="#6741D9" />
        </radialGradient>
        <radialGradient id="thunderDragonBelly" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#FAB005" />
        </radialGradient>
        <linearGradient
          id="thunderDragonHorn"
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#FAB005" />
          <stop offset="100%" stopColor="#FFE066" />
        </linearGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="92" rx="28" ry="5" fill="#00000022" />

      {/* 尾巴 */}
      <path
        d="M75 65 Q90 70 95 60 Q92 55 88 58 Q85 50 80 55 Q78 60 75 65"
        fill="url(#thunderDragonBody)"
      />
      {/* 尾巴閃電 */}
      <path
        d="M92 58 L95 55 L93 58 L96 55"
        stroke="#FFE066"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 後腿 */}
      <ellipse cx="65" cy="78" rx="10" ry="8" fill="url(#thunderDragonBody)" />
      <ellipse cx="35" cy="78" rx="10" ry="8" fill="url(#thunderDragonBody)" />

      {/* 身體 */}
      <ellipse cx="50" cy="58" rx="30" ry="25" fill="url(#thunderDragonBody)" />

      {/* 肚子 */}
      <ellipse
        cx="50"
        cy="62"
        rx="18"
        ry="16"
        fill="url(#thunderDragonBelly)"
      />
      {/* 肚子紋路 */}
      <path
        d="M38 55 Q50 52 62 55"
        fill="none"
        stroke="#FAB005"
        strokeWidth="1"
      />
      <path
        d="M36 62 Q50 58 64 62"
        fill="none"
        stroke="#FAB005"
        strokeWidth="1"
      />
      <path
        d="M38 69 Q50 65 62 69"
        fill="none"
        stroke="#FAB005"
        strokeWidth="1"
      />

      {/* 翅膀 - 左 */}
      <path
        d="M20 45 Q5 30 10 20 Q15 30 20 25 Q22 35 28 30 Q25 40 20 45"
        fill="url(#thunderDragonBody)"
      />
      <path
        d="M12 22 L18 28 M15 25 L20 30"
        stroke="#FFE066"
        strokeWidth="1.5"
      />

      {/* 翅膀 - 右 */}
      <path
        d="M80 45 Q95 30 90 20 Q85 30 80 25 Q78 35 72 30 Q75 40 80 45"
        fill="url(#thunderDragonBody)"
      />
      <path
        d="M88 22 L82 28 M85 25 L80 30"
        stroke="#FFE066"
        strokeWidth="1.5"
      />

      {/* 前腿 */}
      <ellipse cx="32" cy="68" rx="8" ry="6" fill="url(#thunderDragonBody)" />
      <ellipse cx="68" cy="68" rx="8" ry="6" fill="url(#thunderDragonBody)" />

      {/* 頭 */}
      <ellipse cx="50" cy="30" rx="18" ry="16" fill="url(#thunderDragonBody)" />

      {/* 角 */}
      <path d="M35 22 L28 8 L38 18 Z" fill="url(#thunderDragonHorn)" />
      <path d="M65 22 L72 8 L62 18 Z" fill="url(#thunderDragonHorn)" />

      {/* 耳朵/鰭 */}
      <path d="M30 28 L22 25 L28 32 Z" fill="url(#thunderDragonBody)" />
      <path d="M70 28 L78 25 L72 32 Z" fill="url(#thunderDragonBody)" />

      {/* 眼睛 */}
      <ellipse cx="43" cy="28" rx="5" ry="6" fill="white" />
      <ellipse cx="57" cy="28" rx="5" ry="6" fill="white" />
      <circle cx="44" cy="29" r="3" fill="#FAB005" />
      <circle cx="58" cy="29" r="3" fill="#FAB005" />
      <circle cx="45" cy="27" r="1.5" fill="white" />
      <circle cx="59" cy="27" r="1.5" fill="white" />

      {/* 鼻孔 */}
      <circle cx="46" cy="36" r="1.5" fill="#4C3D99" />
      <circle cx="54" cy="36" r="1.5" fill="#4C3D99" />

      {/* 嘴巴 */}
      <path
        d="M44 40 Q50 44 56 40"
        fill="none"
        stroke="#4C3D99"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 閃電裝飾 */}
      <path
        d="M8 50 L12 45 L10 48 L15 42"
        stroke="#FFE066"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M92 50 L88 45 L90 48 L85 42"
        stroke="#FFE066"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="15" cy="60" r="2" fill="#FFE066" />
      <circle cx="85" cy="60" r="2" fill="#FFE066" />
    </motion.svg>
  );
}

export default ThunderDragon;
