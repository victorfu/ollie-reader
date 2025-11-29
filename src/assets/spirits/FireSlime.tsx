import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 火焰史萊姆 - 圓潤可愛的火屬性精靈
export function FireSlime({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const bounceAnimation = animate
    ? {
        y: [0, -8, 0],
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
      {/* 身體 - 橘紅色史萊姆 */}
      <defs>
        <radialGradient id="fireSlimeBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF6B35" />
          <stop offset="100%" stopColor="#D62828" />
        </radialGradient>
        <radialGradient id="fireSlimeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD166" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 光暈效果 */}
      <ellipse cx="50" cy="75" rx="35" ry="10" fill="#00000022" />
      <circle cx="50" cy="50" r="45" fill="url(#fireSlimeGlow)" />

      {/* 主體 */}
      <ellipse cx="50" cy="55" rx="35" ry="30" fill="url(#fireSlimeBody)" />

      {/* 火焰頭頂 */}
      <path
        d="M35 35 Q40 15 50 25 Q55 10 60 20 Q70 5 65 35"
        fill="#FFD166"
        stroke="#FF9F1C"
        strokeWidth="2"
      />

      {/* 眼睛 */}
      <ellipse cx="40" cy="50" rx="6" ry="8" fill="white" />
      <ellipse cx="60" cy="50" rx="6" ry="8" fill="white" />
      <circle cx="42" cy="52" r="3" fill="#1a1a2e" />
      <circle cx="62" cy="52" r="3" fill="#1a1a2e" />
      <circle cx="43" cy="50" r="1.5" fill="white" />
      <circle cx="63" cy="50" r="1.5" fill="white" />

      {/* 嘴巴 */}
      <path
        d="M45 65 Q50 70 55 65"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 臉頰紅暈 */}
      <ellipse cx="32" cy="58" rx="5" ry="3" fill="#FF9F1C" opacity="0.5" />
      <ellipse cx="68" cy="58" rx="5" ry="3" fill="#FF9F1C" opacity="0.5" />
    </motion.svg>
  );
}

export default FireSlime;
