import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 大地石人 - 堅毅的岩石精靈
export function EarthGolem({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const bounceAnimation = animate
    ? {
        y: [0, -4, 0],
        transition: {
          duration: 1.5,
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
      animate={bounceAnimation}
    >
      <defs>
        <radialGradient id="earthGolemBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#A9845B" />
          <stop offset="100%" stopColor="#7A5A3B" />
        </radialGradient>
        <radialGradient id="earthGolemDark" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#7A5A3B" />
          <stop offset="100%" stopColor="#5C4030" />
        </radialGradient>
        <radialGradient id="earthGolemMoss" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#8FBC8F" />
          <stop offset="100%" stopColor="#5D8A5D" />
        </radialGradient>
        <radialGradient id="earthGolemGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#90EE90" />
          <stop offset="100%" stopColor="#5D8A5D" />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="92" rx="26" ry="6" fill="#00000033" />

      {/* 身體 - 不規則岩石形狀 */}
      <path
        d="M25 55 L22 70 L28 85 L45 88 L55 88 L72 85 L78 70 L75 55 L70 45 L55 40 L45 40 L30 45 Z"
        fill="url(#earthGolemBody)"
      />

      {/* 身體裂紋 */}
      <path
        d="M35 50 L40 65 L35 75"
        fill="none"
        stroke="#5C4030"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M65 52 L60 62 L65 72"
        fill="none"
        stroke="#5C4030"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M45 60 L50 70 L55 60"
        fill="none"
        stroke="#5C4030"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 手臂 */}
      <ellipse cx="18" cy="60" rx="10" ry="14" fill="url(#earthGolemDark)" />
      <ellipse cx="82" cy="60" rx="10" ry="14" fill="url(#earthGolemDark)" />

      {/* 腳 */}
      <ellipse cx="38" cy="90" rx="12" ry="6" fill="url(#earthGolemDark)" />
      <ellipse cx="62" cy="90" rx="12" ry="6" fill="url(#earthGolemDark)" />

      {/* 頭 */}
      <path
        d="M30 40 L28 25 L35 15 L50 12 L65 15 L72 25 L70 40 L60 45 L40 45 Z"
        fill="url(#earthGolemBody)"
      />

      {/* 頭上的苔蘚 */}
      <ellipse cx="42" cy="14" rx="8" ry="5" fill="url(#earthGolemMoss)" />
      <ellipse cx="55" cy="12" rx="6" ry="4" fill="url(#earthGolemMoss)" />
      <ellipse cx="65" cy="17" rx="5" ry="3" fill="url(#earthGolemMoss)" />

      {/* 小植物 */}
      <path
        d="M42 14 L40 8 M42 14 L44 7 M42 14 L42 6"
        stroke="#5D8A5D"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="40" cy="6" r="2" fill="#90EE90" />
      <circle cx="44" cy="5" r="1.5" fill="#8FBC8F" />

      {/* 眼睛 - 發光的綠色 */}
      <ellipse cx="40" cy="30" rx="8" ry="7" fill="#2C2C2C" />
      <ellipse cx="60" cy="30" rx="8" ry="7" fill="#2C2C2C" />
      <ellipse cx="40" cy="30" rx="5" ry="5" fill="url(#earthGolemGlow)" />
      <ellipse cx="60" cy="30" rx="5" ry="5" fill="url(#earthGolemGlow)" />
      <circle cx="42" cy="28" r="2" fill="white" opacity="0.8" />
      <circle cx="62" cy="28" r="2" fill="white" opacity="0.8" />

      {/* 嘴巴 - 岩石裂縫 */}
      <path
        d="M42 38 L46 40 L50 38 L54 40 L58 38"
        fill="none"
        stroke="#5C4030"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* 肩膀苔蘚 */}
      <ellipse cx="25" cy="50" rx="5" ry="3" fill="url(#earthGolemMoss)" />
      <ellipse cx="75" cy="50" rx="5" ry="3" fill="url(#earthGolemMoss)" />

      {/* 發光的核心 */}
      <circle cx="50" cy="65" r="8" fill="url(#earthGolemGlow)" opacity="0.6" />
      <circle cx="50" cy="65" r="4" fill="#90EE90" opacity="0.8" />
    </motion.svg>
  );
}

export default EarthGolem;
