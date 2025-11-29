import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 水滴狐狸 - 優雅的水屬性精靈
export function WaterFox({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const swayAnimation = animate
    ? {
        rotate: [-5, 5, -5],
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
      animate={swayAnimation}
    >
      <defs>
        <radialGradient id="waterFoxBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#74C0FC" />
          <stop offset="100%" stopColor="#1C7ED6" />
        </radialGradient>
        <radialGradient id="waterFoxBelly" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#E7F5FF" />
          <stop offset="100%" stopColor="#A5D8FF" />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="90" rx="25" ry="6" fill="#00000022" />

      {/* 尾巴 */}
      <path
        d="M70 65 Q95 50 85 35 Q80 45 75 55 Q72 60 70 65"
        fill="url(#waterFoxBody)"
      />
      <path
        d="M75 55 Q85 45 82 38"
        fill="none"
        stroke="#E7F5FF"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* 身體 */}
      <ellipse cx="50" cy="60" rx="28" ry="25" fill="url(#waterFoxBody)" />

      {/* 肚子 */}
      <ellipse cx="50" cy="65" rx="18" ry="15" fill="url(#waterFoxBelly)" />

      {/* 頭 */}
      <circle cx="50" cy="35" r="22" fill="url(#waterFoxBody)" />

      {/* 耳朵 */}
      <path d="M30 25 L25 5 L40 20 Z" fill="url(#waterFoxBody)" />
      <path d="M70 25 L75 5 L60 20 Z" fill="url(#waterFoxBody)" />
      <path d="M32 22 L29 10 L38 20 Z" fill="#A5D8FF" />
      <path d="M68 22 L71 10 L62 20 Z" fill="#A5D8FF" />

      {/* 眼睛 */}
      <ellipse cx="42" cy="32" rx="5" ry="6" fill="white" />
      <ellipse cx="58" cy="32" rx="5" ry="6" fill="white" />
      <circle cx="43" cy="33" r="3" fill="#1a1a2e" />
      <circle cx="59" cy="33" r="3" fill="#1a1a2e" />
      <circle cx="44" cy="31" r="1.5" fill="white" />
      <circle cx="60" cy="31" r="1.5" fill="white" />

      {/* 鼻子 */}
      <ellipse cx="50" cy="40" rx="3" ry="2" fill="#1a1a2e" />

      {/* 嘴巴 */}
      <path
        d="M47 44 Q50 47 53 44"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 水滴裝飾 */}
      <path d="M15 50 Q15 40 20 45 Q15 55 15 50" fill="#74C0FC" opacity="0.7" />
      <path d="M85 55 Q85 45 90 50 Q85 60 85 55" fill="#74C0FC" opacity="0.7" />
    </motion.svg>
  );
}

export default WaterFox;
