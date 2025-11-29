import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 葉子兔 - 活潑的草屬性精靈
export function LeafBunny({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const hopAnimation = animate
    ? {
        y: [0, -12, 0],
        scaleY: [1, 0.9, 1],
        transition: {
          duration: 0.8,
          repeat: Infinity,
          ease: "easeOut" as const,
        },
      }
    : {};

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      animate={hopAnimation}
    >
      <defs>
        <radialGradient id="leafBunnyBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#8CE99A" />
          <stop offset="100%" stopColor="#40C057" />
        </radialGradient>
        <radialGradient id="leafBunnyBelly" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#F8F9FA" />
          <stop offset="100%" stopColor="#D3F9D8" />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="88" rx="22" ry="5" fill="#00000022" />

      {/* 耳朵 */}
      <ellipse cx="35" cy="20" rx="8" ry="20" fill="url(#leafBunnyBody)" />
      <ellipse cx="65" cy="20" rx="8" ry="20" fill="url(#leafBunnyBody)" />
      <ellipse cx="35" cy="20" rx="4" ry="14" fill="#FFB3BA" />
      <ellipse cx="65" cy="20" rx="4" ry="14" fill="#FFB3BA" />

      {/* 葉子裝飾在耳朵上 */}
      <path d="M30 8 Q25 3 28 0 Q35 5 30 8" fill="#2F9E44" />
      <path d="M70 8 Q75 3 72 0 Q65 5 70 8" fill="#2F9E44" />

      {/* 身體 */}
      <ellipse cx="50" cy="60" rx="25" ry="28" fill="url(#leafBunnyBody)" />

      {/* 肚子 */}
      <ellipse cx="50" cy="65" rx="16" ry="18" fill="url(#leafBunnyBelly)" />

      {/* 頭 */}
      <circle cx="50" cy="42" r="20" fill="url(#leafBunnyBody)" />

      {/* 眼睛 */}
      <ellipse cx="43" cy="40" rx="5" ry="6" fill="white" />
      <ellipse cx="57" cy="40" rx="5" ry="6" fill="white" />
      <circle cx="44" cy="41" r="3" fill="#1a1a2e" />
      <circle cx="58" cy="41" r="3" fill="#1a1a2e" />
      <circle cx="45" cy="39" r="1.5" fill="white" />
      <circle cx="59" cy="39" r="1.5" fill="white" />

      {/* 鼻子 */}
      <ellipse cx="50" cy="48" rx="3" ry="2.5" fill="#FFB3BA" />

      {/* 嘴巴 - 兔子 Y 型 */}
      <path
        d="M50 50 L50 54"
        stroke="#1a1a2e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M46 55 Q50 58 54 55"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 臉頰紅暈 */}
      <ellipse cx="35" cy="48" rx="4" ry="2.5" fill="#FFB3BA" opacity="0.6" />
      <ellipse cx="65" cy="48" rx="4" ry="2.5" fill="#FFB3BA" opacity="0.6" />

      {/* 小腳 */}
      <ellipse cx="38" cy="85" rx="8" ry="5" fill="url(#leafBunnyBody)" />
      <ellipse cx="62" cy="85" rx="8" ry="5" fill="url(#leafBunnyBody)" />

      {/* 尾巴（小圓球） */}
      <circle cx="75" cy="70" r="8" fill="url(#leafBunnyBelly)" />
    </motion.svg>
  );
}

export default LeafBunny;
