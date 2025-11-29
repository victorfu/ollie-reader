import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 岩石龜 - 穩重的普通屬性精靈（稀有）
export function RockTurtle({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const breatheAnimation = animate
    ? {
        scaleX: [1, 1.02, 1],
        transition: {
          duration: 2,
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
      animate={breatheAnimation}
    >
      <defs>
        <radialGradient id="rockTurtleShell" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#A5D8FF" />
          <stop offset="100%" stopColor="#339AF0" />
        </radialGradient>
        <radialGradient id="rockTurtleBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#96F2D7" />
          <stop offset="100%" stopColor="#20C997" />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="88" rx="32" ry="6" fill="#00000022" />

      {/* 尾巴 */}
      <ellipse cx="85" cy="65" rx="8" ry="5" fill="url(#rockTurtleBody)" />

      {/* 後腳 */}
      <ellipse cx="25" cy="75" rx="10" ry="8" fill="url(#rockTurtleBody)" />
      <ellipse cx="75" cy="75" rx="10" ry="8" fill="url(#rockTurtleBody)" />

      {/* 龜殼 */}
      <ellipse cx="50" cy="55" rx="35" ry="28" fill="url(#rockTurtleShell)" />

      {/* 龜殼紋路 */}
      <path
        d="M50 30 L35 45 L50 55 L65 45 Z"
        fill="none"
        stroke="#1C7ED6"
        strokeWidth="2"
      />
      <path
        d="M35 45 L20 55 L35 70 L50 55 Z"
        fill="none"
        stroke="#1C7ED6"
        strokeWidth="2"
      />
      <path
        d="M65 45 L80 55 L65 70 L50 55 Z"
        fill="none"
        stroke="#1C7ED6"
        strokeWidth="2"
      />
      <path
        d="M35 70 L50 80 L65 70 L50 55 Z"
        fill="none"
        stroke="#1C7ED6"
        strokeWidth="2"
      />

      {/* 前腳 */}
      <ellipse cx="20" cy="60" rx="10" ry="7" fill="url(#rockTurtleBody)" />
      <ellipse cx="80" cy="60" rx="10" ry="7" fill="url(#rockTurtleBody)" />

      {/* 頭 */}
      <ellipse cx="50" cy="28" rx="15" ry="12" fill="url(#rockTurtleBody)" />

      {/* 眼睛 */}
      <ellipse cx="45" cy="26" rx="4" ry="5" fill="white" />
      <ellipse cx="55" cy="26" rx="4" ry="5" fill="white" />
      <circle cx="46" cy="27" r="2.5" fill="#1a1a2e" />
      <circle cx="56" cy="27" r="2.5" fill="#1a1a2e" />
      <circle cx="47" cy="25" r="1" fill="white" />
      <circle cx="57" cy="25" r="1" fill="white" />

      {/* 鼻孔 */}
      <circle cx="48" cy="32" r="1" fill="#1a1a2e" />
      <circle cx="52" cy="32" r="1" fill="#1a1a2e" />

      {/* 嘴巴 */}
      <path
        d="M46 36 Q50 38 54 36"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 臉頰紅暈 */}
      <ellipse cx="38" cy="30" rx="4" ry="2.5" fill="#FFB3BA" opacity="0.5" />
      <ellipse cx="62" cy="30" rx="4" ry="2.5" fill="#FFB3BA" opacity="0.5" />

      {/* 水滴裝飾 */}
      <path d="M10 40 Q10 35 13 38 Q10 45 10 40" fill="#74C0FC" opacity="0.6" />
    </motion.svg>
  );
}

export default RockTurtle;
