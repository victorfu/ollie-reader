import { motion } from "framer-motion";
import { useMemo } from "react";
import { getSceneTheme, type SceneTheme } from "../../constants/sceneThemes";

interface SceneBackgroundProps {
  stageId: string;
  children: React.ReactNode;
}

// Generate random particle positions once
function generateParticlePositions(count: number) {
  return Array.from({ length: count }, () => ({
    top: Math.random() * 100,
    left: Math.random() * 100,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 5,
  }));
}

export function SceneBackground({ stageId, children }: SceneBackgroundProps) {
  const theme: SceneTheme = useMemo(() => getSceneTheme(stageId), [stageId]);
  const particlePositions = useMemo(() => generateParticlePositions(10), []);

  return (
    <div
      className={`relative min-h-[calc(100vh-8rem)] bg-gradient-to-b ${theme.bgGradient} rounded-2xl overflow-hidden`}
    >
      {/* Animated glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-32 h-32 rounded-full blur-[80px] opacity-60"
          style={{ backgroundColor: theme.glowColor }}
          animate={{
            x: [0, 50, 0, -50, 0],
            y: [0, -30, 0, 30, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          initial={{ top: "20%", left: "10%" }}
        />
        <motion.div
          className="absolute w-40 h-40 rounded-full blur-[100px] opacity-50"
          style={{ backgroundColor: theme.glowColor }}
          animate={{
            x: [0, -40, 0, 40, 0],
            y: [0, 40, 0, -40, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          initial={{ bottom: "20%", right: "10%" }}
        />
        <motion.div
          className="absolute w-48 h-48 rounded-full blur-[120px] opacity-30"
          style={{ backgroundColor: theme.glowColor }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          initial={{ top: "40%", left: "40%" }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {theme.particles.map((particle, i) => {
          const pos = particlePositions[i];
          return (
            <motion.div
              key={i}
              className="absolute text-2xl"
              style={{
                top: `${pos.top}%`,
                left: `${pos.left}%`,
              }}
              animate={{
                y: [-20, 20, -20],
                x: [-10, 10, -10],
                rotate: [0, 10, -10, 0],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: pos.duration,
                repeat: Infinity,
                delay: pos.delay,
                ease: "easeInOut",
              }}
            >
              {particle}
            </motion.div>
          );
        })}
      </div>

      {/* Scene name badge */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-4 z-20"
      >
        <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-white/50">
          <span className="text-xs font-medium text-base-content/70 flex items-center gap-1">
            <span>📍</span>
            {theme.name}
          </span>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10">{children}</div>

      {/* Bottom decorative elements */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/30 to-transparent pointer-events-none" />
    </div>
  );
}

export default SceneBackground;
