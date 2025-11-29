import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 棉花雲 - 溫柔的普通屬性精靈
export function CloudPuff({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const floatAnimation = animate
    ? {
        y: [0, -6, 0],
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
      animate={floatAnimation}
    >
      <defs>
        <radialGradient id="cloudPuffBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#DEE2E6" />
        </radialGradient>
        <radialGradient id="cloudPuffCheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD6E0" />
          <stop offset="100%" stopColor="#FFADC6" />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="88" rx="28" ry="5" fill="#00000015" />

      {/* 雲朵身體 - 多個圓形組成 */}
      <circle cx="35" cy="55" r="18" fill="url(#cloudPuffBody)" />
      <circle cx="65" cy="55" r="18" fill="url(#cloudPuffBody)" />
      <circle cx="50" cy="50" r="22" fill="url(#cloudPuffBody)" />
      <circle cx="30" cy="45" r="14" fill="url(#cloudPuffBody)" />
      <circle cx="70" cy="45" r="14" fill="url(#cloudPuffBody)" />
      <circle cx="50" cy="38" r="16" fill="url(#cloudPuffBody)" />

      {/* 底部填充 */}
      <ellipse cx="50" cy="65" rx="30" ry="12" fill="url(#cloudPuffBody)" />

      {/* 眼睛 */}
      <ellipse cx="42" cy="48" rx="5" ry="6" fill="#1a1a2e" />
      <ellipse cx="58" cy="48" rx="5" ry="6" fill="#1a1a2e" />
      <ellipse cx="43" cy="46" rx="2" ry="2.5" fill="white" />
      <ellipse cx="59" cy="46" rx="2" ry="2.5" fill="white" />

      {/* 臉頰紅暈 */}
      <ellipse
        cx="32"
        cy="55"
        rx="6"
        ry="4"
        fill="url(#cloudPuffCheek)"
        opacity="0.7"
      />
      <ellipse
        cx="68"
        cy="55"
        rx="6"
        ry="4"
        fill="url(#cloudPuffCheek)"
        opacity="0.7"
      />

      {/* 嘴巴 - 可愛的貓嘴 */}
      <path
        d="M45 58 Q50 62 55 58"
        fill="none"
        stroke="#868E96"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 小翅膀/手 */}
      <ellipse cx="18" cy="50" rx="8" ry="5" fill="url(#cloudPuffBody)" />
      <ellipse cx="82" cy="50" rx="8" ry="5" fill="url(#cloudPuffBody)" />

      {/* 星星裝飾 */}
      <path
        d="M15 30 L16 33 L19 33 L17 35 L18 38 L15 36 L12 38 L13 35 L11 33 L14 33 Z"
        fill="#FFE066"
      />
      <path
        d="M85 35 L86 37 L88 37 L86.5 38.5 L87 41 L85 39.5 L83 41 L83.5 38.5 L82 37 L84 37 Z"
        fill="#FFE066"
      />
    </motion.svg>
  );
}

export default CloudPuff;
