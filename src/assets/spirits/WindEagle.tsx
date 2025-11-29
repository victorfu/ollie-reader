import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 疾風鷹 - 迅捷的風之精靈
export function WindEagle({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const soarAnimation = animate
    ? {
        y: [-5, 5, -5],
        rotate: [-2, 2, -2],
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
      animate={soarAnimation}
    >
      <defs>
        <radialGradient id="windEagleBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#66D9E8" />
          <stop offset="100%" stopColor="#22B8CF" />
        </radialGradient>
        <radialGradient id="windEagleLight" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C5F6FA" />
        </radialGradient>
        <radialGradient id="windEagleDark" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#22B8CF" />
          <stop offset="100%" stopColor="#0C8599" />
        </radialGradient>
        <linearGradient id="windEagleWing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#66D9E8" />
          <stop offset="50%" stopColor="#22B8CF" />
          <stop offset="100%" stopColor="#0C8599" />
        </linearGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="92" rx="20" ry="4" fill="#00000022" />

      {/* 左翅膀 */}
      <path
        d="M35 45 Q10 35 5 50 Q8 52 15 50 Q12 55 8 60 Q12 60 18 58 Q15 65 12 70 Q18 67 25 62 L35 55 Z"
        fill="url(#windEagleWing)"
      />
      {/* 翅膀羽毛紋理 */}
      <path
        d="M30 48 L20 45"
        stroke="#C5F6FA"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M28 54 L18 55"
        stroke="#C5F6FA"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* 右翅膀 */}
      <path
        d="M65 45 Q90 35 95 50 Q92 52 85 50 Q88 55 92 60 Q88 60 82 58 Q85 65 88 70 Q82 67 75 62 L65 55 Z"
        fill="url(#windEagleWing)"
      />
      {/* 翅膀羽毛紋理 */}
      <path
        d="M70 48 L80 45"
        stroke="#C5F6FA"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M72 54 L82 55"
        stroke="#C5F6FA"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* 尾巴 */}
      <path
        d="M42 75 L35 90 L42 85 L50 92 L58 85 L65 90 L58 75"
        fill="url(#windEagleDark)"
      />

      {/* 身體 */}
      <ellipse cx="50" cy="58" rx="18" ry="22" fill="url(#windEagleBody)" />

      {/* 胸部白色羽毛 */}
      <ellipse cx="50" cy="62" rx="12" ry="15" fill="url(#windEagleLight)" />
      {/* 胸部紋理 */}
      <path
        d="M44 55 Q50 58 56 55"
        fill="none"
        stroke="#22B8CF"
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        d="M45 62 Q50 64 55 62"
        fill="none"
        stroke="#22B8CF"
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        d="M46 69 Q50 71 54 69"
        fill="none"
        stroke="#22B8CF"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* 頭 */}
      <circle cx="50" cy="32" r="18" fill="url(#windEagleBody)" />

      {/* 頭頂羽冠 */}
      <path d="M45 18 L42 5 L48 15 Z" fill="url(#windEagleDark)" />
      <path d="M50 16 L50 2 L55 14 Z" fill="url(#windEagleBody)" />
      <path d="M55 18 L58 5 L52 15 Z" fill="url(#windEagleDark)" />

      {/* 眼睛周圍白色 */}
      <ellipse cx="42" cy="30" rx="8" ry="7" fill="white" />
      <ellipse cx="58" cy="30" rx="8" ry="7" fill="white" />

      {/* 眼睛 - 銳利的金色 */}
      <ellipse cx="42" cy="30" rx="5" ry="5" fill="#FAB005" />
      <ellipse cx="58" cy="30" rx="5" ry="5" fill="#FAB005" />
      <ellipse cx="42" cy="30" rx="2.5" ry="3" fill="#1a1a2e" />
      <ellipse cx="58" cy="30" rx="2.5" ry="3" fill="#1a1a2e" />
      <circle cx="43" cy="28" r="1.5" fill="white" />
      <circle cx="59" cy="28" r="1.5" fill="white" />

      {/* 眉毛 - 銳利 */}
      <path
        d="M34 25 L44 27"
        fill="none"
        stroke="#0C8599"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M66 25 L56 27"
        fill="none"
        stroke="#0C8599"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* 鷹喙 */}
      <path d="M50 35 L45 40 L50 48 L55 40 Z" fill="#FAB005" />
      <path d="M50 35 L47 40 L50 44 L53 40 Z" fill="#F59F00" />

      {/* 風的效果線 */}
      <path
        d="M5 40 Q10 38 15 40"
        fill="none"
        stroke="#66D9E8"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M85 40 Q90 38 95 40"
        fill="none"
        stroke="#66D9E8"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M8 48 Q12 46 16 48"
        fill="none"
        stroke="#99E9F2"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M84 48 Q88 46 92 48"
        fill="none"
        stroke="#99E9F2"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* 爪子 */}
      <path
        d="M40 78 L38 85 M42 78 L42 86 M44 78 L46 85"
        stroke="#FAB005"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M56 78 L54 85 M58 78 L58 86 M60 78 L62 85"
        stroke="#FAB005"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

export default WindEagle;
