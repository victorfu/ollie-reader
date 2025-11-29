import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 暗影貓 - 神秘的影子精靈
export function ShadowCat({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const swayAnimation = animate
    ? {
        rotate: [-3, 3, -3],
        transition: {
          duration: 3,
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
      animate={swayAnimation}
    >
      <defs>
        <radialGradient id="shadowCatBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#845EF7" />
          <stop offset="100%" stopColor="#5F3DC4" />
        </radialGradient>
        <radialGradient id="shadowCatDark" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#5F3DC4" />
          <stop offset="100%" stopColor="#3B2A7A" />
        </radialGradient>
        <radialGradient id="shadowCatEye" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#BE4BDB" />
          <stop offset="100%" stopColor="#9C36B5" />
        </radialGradient>
      </defs>

      {/* 陰影 - 更模糊的影子效果 */}
      <ellipse cx="50" cy="90" rx="28" ry="6" fill="#3B2A7A" opacity="0.5" />

      {/* 尾巴 - 長而捲曲 */}
      <path
        d="M75 70 Q95 65 92 45 Q90 35 85 30 Q88 40 85 50 Q80 60 75 65"
        fill="url(#shadowCatBody)"
      />
      <circle cx="85" cy="32" r="5" fill="url(#shadowCatBody)" />

      {/* 身體 */}
      <ellipse cx="50" cy="65" rx="26" ry="22" fill="url(#shadowCatBody)" />

      {/* 前腿 */}
      <ellipse cx="35" cy="82" rx="6" ry="10" fill="url(#shadowCatDark)" />
      <ellipse cx="65" cy="82" rx="6" ry="10" fill="url(#shadowCatDark)" />
      <ellipse cx="35" cy="88" rx="7" ry="4" fill="url(#shadowCatBody)" />
      <ellipse cx="65" cy="88" rx="7" ry="4" fill="url(#shadowCatBody)" />

      {/* 頭 */}
      <circle cx="50" cy="38" r="24" fill="url(#shadowCatBody)" />

      {/* 耳朵 */}
      <path d="M28 28 L22 5 L38 22 Z" fill="url(#shadowCatBody)" />
      <path d="M72 28 L78 5 L62 22 Z" fill="url(#shadowCatBody)" />
      <path d="M30 25 L26 12 L36 22 Z" fill="#BE4BDB" opacity="0.5" />
      <path d="M70 25 L74 12 L64 22 Z" fill="#BE4BDB" opacity="0.5" />

      {/* 臉部陰影 */}
      <ellipse
        cx="50"
        cy="42"
        rx="16"
        ry="12"
        fill="url(#shadowCatDark)"
        opacity="0.3"
      />

      {/* 眼睛 - 發光的紫色 */}
      <ellipse cx="40" cy="35" rx="7" ry="8" fill="#1a1a2e" />
      <ellipse cx="60" cy="35" rx="7" ry="8" fill="#1a1a2e" />
      <ellipse cx="40" cy="35" rx="5" ry="6" fill="url(#shadowCatEye)" />
      <ellipse cx="60" cy="35" rx="5" ry="6" fill="url(#shadowCatEye)" />
      <ellipse cx="40" cy="35" rx="2" ry="5" fill="#1a1a2e" />
      <ellipse cx="60" cy="35" rx="2" ry="5" fill="#1a1a2e" />
      <circle cx="42" cy="33" r="1.5" fill="white" />
      <circle cx="62" cy="33" r="1.5" fill="white" />

      {/* 鼻子 */}
      <path d="M50 44 L48 47 L52 47 Z" fill="#E599F7" />

      {/* 嘴巴 */}
      <path
        d="M50 47 L50 50"
        fill="none"
        stroke="#3B2A7A"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M46 50 Q50 53 54 50"
        fill="none"
        stroke="#3B2A7A"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 鬍鬚 */}
      <path
        d="M30 42 L42 44"
        fill="none"
        stroke="#E599F7"
        strokeWidth="1"
        opacity="0.6"
      />
      <path
        d="M28 46 L42 46"
        fill="none"
        stroke="#E599F7"
        strokeWidth="1"
        opacity="0.6"
      />
      <path
        d="M70 42 L58 44"
        fill="none"
        stroke="#E599F7"
        strokeWidth="1"
        opacity="0.6"
      />
      <path
        d="M72 46 L58 46"
        fill="none"
        stroke="#E599F7"
        strokeWidth="1"
        opacity="0.6"
      />

      {/* 神秘的煙霧效果 */}
      <ellipse cx="20" cy="75" rx="8" ry="4" fill="#845EF7" opacity="0.3" />
      <ellipse cx="80" cy="72" rx="6" ry="3" fill="#845EF7" opacity="0.3" />
      <ellipse cx="15" cy="65" rx="5" ry="3" fill="#BE4BDB" opacity="0.2" />
    </motion.svg>
  );
}

export default ShadowCat;
