import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 冰晶狼 - 帥氣的水屬性精靈（稀有）
export function IceWolf({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const glowAnimation = animate
    ? {
        opacity: [0.8, 1, 0.8],
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
    >
      <defs>
        <radialGradient id="iceWolfBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#E7F5FF" />
          <stop offset="100%" stopColor="#74C0FC" />
        </radialGradient>
        <radialGradient id="iceWolfDark" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#339AF0" />
          <stop offset="100%" stopColor="#1C7ED6" />
        </radialGradient>
        <linearGradient id="iceWolfGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A5D8FF" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#74C0FC" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 光暈 */}
      <motion.ellipse
        cx="50"
        cy="55"
        rx="42"
        ry="35"
        fill="url(#iceWolfGlow)"
        animate={glowAnimation}
      />

      {/* 陰影 */}
      <ellipse cx="50" cy="90" rx="25" ry="5" fill="#00000022" />

      {/* 尾巴 */}
      <path
        d="M75 60 Q90 45 85 30 Q80 40 78 50 Q76 55 75 60"
        fill="url(#iceWolfBody)"
      />
      <path
        d="M80 45 Q88 38 85 32"
        fill="none"
        stroke="#A5D8FF"
        strokeWidth="2"
      />

      {/* 後腿 */}
      <ellipse cx="70" cy="75" rx="8" ry="12" fill="url(#iceWolfBody)" />
      <ellipse cx="30" cy="75" rx="8" ry="12" fill="url(#iceWolfBody)" />

      {/* 身體 */}
      <ellipse cx="50" cy="58" rx="28" ry="22" fill="url(#iceWolfBody)" />

      {/* 胸毛 */}
      <path
        d="M35 50 Q40 60 35 70 Q45 65 50 70 Q55 65 65 70 Q60 60 65 50 Q50 55 35 50"
        fill="#E7F5FF"
      />

      {/* 前腿 */}
      <ellipse cx="35" cy="72" rx="6" ry="10" fill="url(#iceWolfBody)" />
      <ellipse cx="65" cy="72" rx="6" ry="10" fill="url(#iceWolfBody)" />

      {/* 頭 */}
      <ellipse cx="50" cy="32" rx="20" ry="18" fill="url(#iceWolfBody)" />

      {/* 耳朵 */}
      <path d="M30 25 L25 5 L40 18 Z" fill="url(#iceWolfBody)" />
      <path d="M70 25 L75 5 L60 18 Z" fill="url(#iceWolfBody)" />
      <path d="M32 22 L29 12 L37 19 Z" fill="url(#iceWolfDark)" />
      <path d="M68 22 L71 12 L63 19 Z" fill="url(#iceWolfDark)" />

      {/* 臉部花紋 */}
      <path
        d="M50 18 L50 28"
        stroke="url(#iceWolfDark)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* 眼睛 */}
      <ellipse cx="42" cy="30" rx="5" ry="6" fill="white" />
      <ellipse cx="58" cy="30" rx="5" ry="6" fill="white" />
      <circle cx="43" cy="31" r="3" fill="#1C7ED6" />
      <circle cx="59" cy="31" r="3" fill="#1C7ED6" />
      <circle cx="44" cy="29" r="1.5" fill="white" />
      <circle cx="60" cy="29" r="1.5" fill="white" />

      {/* 鼻子 */}
      <ellipse cx="50" cy="38" rx="4" ry="3" fill="url(#iceWolfDark)" />
      <ellipse cx="50" cy="37" rx="2" ry="1" fill="#A5D8FF" />

      {/* 嘴巴 */}
      <path
        d="M46 42 Q50 45 54 42"
        fill="none"
        stroke="#1C7ED6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 冰晶裝飾 */}
      <path d="M10 25 L12 20 L14 25 L12 30 Z" fill="#A5D8FF" opacity="0.8" />
      <path d="M88 40 L90 35 L92 40 L90 45 Z" fill="#A5D8FF" opacity="0.8" />
      <circle cx="15" cy="40" r="2" fill="#E7F5FF" />
      <circle cx="85" cy="55" r="2" fill="#E7F5FF" />
    </motion.svg>
  );
}

export default IceWolf;
