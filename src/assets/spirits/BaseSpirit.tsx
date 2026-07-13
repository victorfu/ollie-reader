import { motion } from "framer-motion";

export interface BaseSpiritProps {
  size?: number;
  className?: string;
  animate?: boolean;
  gid: string; // 唯一漸層 id 前綴（用精靈 id，避免多實例 defs 撞 id）
  bodyFrom: string;
  bodyTo: string;
  belly: string;
  cheek: string;
  motif: string; // 頭上的主題 emoji
  ears?: "bunny" | "cat" | "none";
  sparkle?: boolean; // 傳說級加閃光
}

/**
 * 參數化的可愛精靈：圓潤身體 + 大頭 + 笑臉 + 主題 emoji。
 * 供第二章 / 進化 / 扭蛋等新精靈共用，維持一致的甜美風格。
 */
export function BaseSpirit({
  size = 80,
  className = "",
  animate = true,
  gid,
  bodyFrom,
  bodyTo,
  belly,
  cheek,
  motif,
  ears = "none",
  sparkle = false,
}: BaseSpiritProps) {
  const bob = animate
    ? {
        y: [0, -10, 0],
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      }
    : {};

  const bodyFill = `url(#${gid}-body)`;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      animate={bob}
    >
      <defs>
        <radialGradient id={`${gid}-body`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={bodyFrom} />
          <stop offset="100%" stopColor={bodyTo} />
        </radialGradient>
      </defs>

      {/* 陰影 */}
      <ellipse cx="50" cy="90" rx="24" ry="5" fill="#00000020" />

      {/* 耳朵 */}
      {ears === "bunny" && (
        <>
          <ellipse cx="37" cy="22" rx="7" ry="17" fill={bodyFill} />
          <ellipse cx="63" cy="22" rx="7" ry="17" fill={bodyFill} />
          <ellipse cx="37" cy="24" rx="3" ry="11" fill={cheek} />
          <ellipse cx="63" cy="24" rx="3" ry="11" fill={cheek} />
        </>
      )}
      {ears === "cat" && (
        <>
          <path d="M33 30 L30 12 L46 24 Z" fill={bodyFill} />
          <path d="M67 30 L70 12 L54 24 Z" fill={bodyFill} />
          <path d="M34 27 L32 18 L42 25 Z" fill={cheek} />
          <path d="M66 27 L68 18 L58 25 Z" fill={cheek} />
        </>
      )}

      {/* 身體 */}
      <ellipse cx="50" cy="62" rx="26" ry="26" fill={bodyFill} />
      {/* 肚子 */}
      <ellipse cx="50" cy="66" rx="16" ry="16" fill={belly} />
      {/* 頭 */}
      <circle cx="50" cy="44" r="21" fill={bodyFill} />

      {/* 主題 emoji */}
      <text x="50" y="20" fontSize="20" textAnchor="middle">
        {motif}
      </text>

      {/* 眼睛 */}
      <ellipse cx="43" cy="43" rx="5" ry="6" fill="white" />
      <ellipse cx="57" cy="43" rx="5" ry="6" fill="white" />
      <circle cx="44" cy="44" r="3" fill="#1a1a2e" />
      <circle cx="58" cy="44" r="3" fill="#1a1a2e" />
      <circle cx="45" cy="42" r="1.4" fill="white" />
      <circle cx="59" cy="42" r="1.4" fill="white" />

      {/* 嘴巴 */}
      <path
        d="M45 52 Q50 57 55 52"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* 臉頰 */}
      <ellipse cx="36" cy="50" rx="4" ry="2.6" fill={cheek} opacity="0.7" />
      <ellipse cx="64" cy="50" rx="4" ry="2.6" fill={cheek} opacity="0.7" />

      {/* 小腳 */}
      <ellipse cx="40" cy="86" rx="8" ry="5" fill={bodyFill} />
      <ellipse cx="60" cy="86" rx="8" ry="5" fill={bodyFill} />

      {/* 傳說閃光 */}
      {sparkle && (
        <>
          <text x="20" y="34" fontSize="12" textAnchor="middle">
            ✨
          </text>
          <text x="80" y="40" fontSize="12" textAnchor="middle">
            ✨
          </text>
          <text x="78" y="74" fontSize="10" textAnchor="middle">
            ✨
          </text>
        </>
      )}
    </motion.svg>
  );
}

export default BaseSpirit;
