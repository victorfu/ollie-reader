import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 雷電鼠 - 活力滿滿的電屬性精靈
export function ThunderMouse({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const sparkAnimation = animate
    ? {
        scale: [1, 1.05, 1],
        transition: {
          duration: 0.3,
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
      animate={sparkAnimation}
    >
      <defs>
        <radialGradient id="thunderMouseBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#FAB005" />
        </radialGradient>
        <radialGradient id="thunderMouseBelly" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFF9DB" />
          <stop offset="100%" stopColor="#FFE066" />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="88" rx="20" ry="5" fill="#00000022" />

      {/* 閃電尾巴 */}
      <path
        d="M75 55 L85 45 L78 50 L88 35 L80 48 L90 40"
        fill="none"
        stroke="#FAB005"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 身體 */}
      <ellipse cx="50" cy="58" rx="24" ry="26" fill="url(#thunderMouseBody)" />

      {/* 肚子 */}
      <ellipse cx="50" cy="62" rx="15" ry="16" fill="url(#thunderMouseBelly)" />

      {/* 頭 */}
      <circle cx="50" cy="38" r="22" fill="url(#thunderMouseBody)" />

      {/* 耳朵 */}
      <ellipse cx="30" cy="22" rx="10" ry="14" fill="url(#thunderMouseBody)" />
      <ellipse cx="70" cy="22" rx="10" ry="14" fill="url(#thunderMouseBody)" />
      <ellipse cx="30" cy="22" rx="5" ry="8" fill="#1a1a2e" />
      <ellipse cx="70" cy="22" rx="5" ry="8" fill="#1a1a2e" />

      {/* 臉頰電氣圓 */}
      <circle cx="30" cy="42" r="7" fill="#FF6B6B" />
      <circle cx="70" cy="42" r="7" fill="#FF6B6B" />

      {/* 眼睛 */}
      <ellipse cx="42" cy="35" rx="6" ry="7" fill="white" />
      <ellipse cx="58" cy="35" rx="6" ry="7" fill="white" />
      <circle cx="43" cy="36" r="4" fill="#1a1a2e" />
      <circle cx="59" cy="36" r="4" fill="#1a1a2e" />
      <circle cx="44" cy="34" r="2" fill="white" />
      <circle cx="60" cy="34" r="2" fill="white" />

      {/* 鼻子 */}
      <ellipse cx="50" cy="44" rx="2.5" ry="2" fill="#1a1a2e" />

      {/* 嘴巴 */}
      <path
        d="M46 48 Q50 52 54 48"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 小手 */}
      <ellipse cx="30" cy="55" rx="6" ry="4" fill="url(#thunderMouseBody)" />
      <ellipse cx="70" cy="55" rx="6" ry="4" fill="url(#thunderMouseBody)" />

      {/* 小腳 */}
      <ellipse cx="40" cy="82" rx="8" ry="5" fill="url(#thunderMouseBody)" />
      <ellipse cx="60" cy="82" rx="8" ry="5" fill="url(#thunderMouseBody)" />

      {/* 閃電裝飾 */}
      <path
        d="M12 30 L18 25 L15 28 L22 22"
        fill="none"
        stroke="#FFE066"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M88 60 L82 65 L85 62 L78 68"
        fill="none"
        stroke="#FFE066"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

export default ThunderMouse;
