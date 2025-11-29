import { motion } from "framer-motion";

interface SpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// 花朵精靈 - 可愛的草屬性精靈
export function FlowerSprite({
  size = 80,
  className = "",
  animate = true,
}: SpiritProps) {
  const danceAnimation = animate
    ? {
        rotate: [-10, 10, -10],
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
      animate={danceAnimation}
    >
      <defs>
        <radialGradient id="flowerSpriteBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#D0BFFF" />
          <stop offset="100%" stopColor="#9775FA" />
        </radialGradient>
        <radialGradient id="flowerSpritePetal" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFC9C9" />
          <stop offset="100%" stopColor="#FF8787" />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="90" rx="18" ry="4" fill="#00000022" />

      {/* 花瓣（頭飾） */}
      <circle cx="50" cy="15" r="10" fill="url(#flowerSpritePetal)" />
      <circle cx="35" cy="22" r="10" fill="url(#flowerSpritePetal)" />
      <circle cx="65" cy="22" r="10" fill="url(#flowerSpritePetal)" />
      <circle cx="30" cy="35" r="10" fill="url(#flowerSpritePetal)" />
      <circle cx="70" cy="35" r="10" fill="url(#flowerSpritePetal)" />

      {/* 花蕊 */}
      <circle cx="50" cy="30" r="12" fill="#FFE066" />
      <circle cx="50" cy="30" r="8" fill="#FAB005" />

      {/* 身體 */}
      <ellipse cx="50" cy="60" rx="20" ry="25" fill="url(#flowerSpriteBody)" />

      {/* 眼睛 */}
      <ellipse cx="44" cy="52" rx="4" ry="5" fill="white" />
      <ellipse cx="56" cy="52" rx="4" ry="5" fill="white" />
      <circle cx="45" cy="53" r="2.5" fill="#1a1a2e" />
      <circle cx="57" cy="53" r="2.5" fill="#1a1a2e" />
      <circle cx="46" cy="51" r="1" fill="white" />
      <circle cx="58" cy="51" r="1" fill="white" />

      {/* 嘴巴 */}
      <path
        d="M46 62 Q50 66 54 62"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 臉頰紅暈 */}
      <ellipse cx="36" cy="58" rx="4" ry="3" fill="#FFB3BA" opacity="0.6" />
      <ellipse cx="64" cy="58" rx="4" ry="3" fill="#FFB3BA" opacity="0.6" />

      {/* 小手（葉子） */}
      <ellipse
        cx="28"
        cy="55"
        rx="8"
        ry="5"
        fill="#69DB7C"
        transform="rotate(-20 28 55)"
      />
      <ellipse
        cx="72"
        cy="55"
        rx="8"
        ry="5"
        fill="#69DB7C"
        transform="rotate(20 72 55)"
      />

      {/* 小腳 */}
      <ellipse cx="42" cy="82" rx="6" ry="4" fill="url(#flowerSpriteBody)" />
      <ellipse cx="58" cy="82" rx="6" ry="4" fill="url(#flowerSpriteBody)" />

      {/* 花粉裝飾 */}
      <circle cx="20" cy="45" r="2" fill="#FFE066" opacity="0.7" />
      <circle cx="80" cy="40" r="2" fill="#FFE066" opacity="0.7" />
      <circle cx="15" cy="55" r="1.5" fill="#FFE066" opacity="0.5" />
      <circle cx="85" cy="50" r="1.5" fill="#FFE066" opacity="0.5" />
    </motion.svg>
  );
}

export default FlowerSprite;
