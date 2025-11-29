import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 星空貓頭鷹 - 神秘的夜行精靈
export function StarOwl({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const floatAnimation = animate
    ? {
        y: [-3, 3, -3],
        transition: {
          duration: 2.5,
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
        <radialGradient id="starOwlBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#9775FA" />
          <stop offset="100%" stopColor="#6741D9" />
        </radialGradient>
        <radialGradient id="starOwlBelly" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#F3F0FF" />
          <stop offset="100%" stopColor="#D0BFFF" />
        </radialGradient>
        <radialGradient id="starOwlGold" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#FAB005" />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="92" rx="20" ry="5" fill="#00000022" />

      {/* 翅膀 */}
      <ellipse cx="25" cy="55" rx="12" ry="20" fill="url(#starOwlBody)" />
      <ellipse cx="75" cy="55" rx="12" ry="20" fill="url(#starOwlBody)" />

      {/* 身體 */}
      <ellipse cx="50" cy="60" rx="25" ry="28" fill="url(#starOwlBody)" />

      {/* 肚子 */}
      <ellipse cx="50" cy="65" rx="16" ry="18" fill="url(#starOwlBelly)" />

      {/* 肚子花紋 */}
      <path
        d="M42 58 Q50 62 58 58"
        fill="none"
        stroke="#9775FA"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M44 65 Q50 68 56 65"
        fill="none"
        stroke="#9775FA"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M46 72 Q50 74 54 72"
        fill="none"
        stroke="#9775FA"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 頭 */}
      <circle cx="50" cy="32" r="22" fill="url(#starOwlBody)" />

      {/* 耳朵（角狀羽毛） */}
      <path d="M32 22 L28 5 L38 18 Z" fill="url(#starOwlBody)" />
      <path d="M68 22 L72 5 L62 18 Z" fill="url(#starOwlBody)" />
      <path d="M33 20 L30 10 L37 18 Z" fill="url(#starOwlGold)" />
      <path d="M67 20 L70 10 L63 18 Z" fill="url(#starOwlGold)" />

      {/* 眼睛外圈 */}
      <circle cx="40" cy="30" r="10" fill="#F3F0FF" />
      <circle cx="60" cy="30" r="10" fill="#F3F0FF" />

      {/* 眼睛 */}
      <circle cx="40" cy="30" r="7" fill="#1a1a2e" />
      <circle cx="60" cy="30" r="7" fill="#1a1a2e" />
      <circle cx="42" cy="28" r="2.5" fill="white" />
      <circle cx="62" cy="28" r="2.5" fill="white" />
      <circle cx="38" cy="32" r="1.5" fill="#FFE066" />
      <circle cx="58" cy="32" r="1.5" fill="#FFE066" />

      {/* 眉毛 */}
      <path
        d="M32 22 Q40 20 48 24"
        fill="none"
        stroke="#6741D9"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M68 22 Q60 20 52 24"
        fill="none"
        stroke="#6741D9"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 嘴巴 */}
      <path d="M50 38 L46 44 L50 42 L54 44 Z" fill="url(#starOwlGold)" />

      {/* 腳 */}
      <ellipse cx="42" cy="88" rx="6" ry="3" fill="url(#starOwlGold)" />
      <ellipse cx="58" cy="88" rx="6" ry="3" fill="url(#starOwlGold)" />

      {/* 星星裝飾 */}
      <path
        d="M15 25 L16 28 L19 28 L17 30 L18 33 L15 31 L12 33 L13 30 L11 28 L14 28 Z"
        fill="#FFE066"
        opacity="0.9"
      />
      <path
        d="M85 35 L86 37 L88 37 L86.5 38.5 L87 41 L85 39.5 L83 41 L83.5 38.5 L82 37 L84 37 Z"
        fill="#FFE066"
        opacity="0.9"
      />
      <circle cx="20" cy="45" r="2" fill="#FFE066" opacity="0.7" />
      <circle cx="80" cy="50" r="1.5" fill="#FFE066" opacity="0.7" />
    </motion.svg>
  );
}

export default StarOwl;
