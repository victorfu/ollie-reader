import type { ReactNode } from "react";

interface GameLayoutProps {
  children: ReactNode;
}

const PARTICLE_EMOJIS = ["🌸", "✨", "💫", "🌟", "💖", "🎀", "🦋", "🌷"];

// Pre-compute particle positions at module scope (stable across renders)
const PARTICLES = PARTICLE_EMOJIS.map((emoji, i) => ({
  id: i,
  emoji,
  top: Math.random() * 100,
  left: Math.random() * 100,
  duration: Math.random() * 10 + 10,
  delay: Math.random() * 5,
}));

export function GameLayout({ children }: GameLayoutProps) {
  const particles = PARTICLES;

  return (
    <div className="h-[calc(100vh-7rem)] sm:h-[calc(100vh-8rem)] w-full bg-gradient-to-b from-primary/10 via-secondary/10 to-accent/10 rounded-2xl shadow-floating border border-border-hairline p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Elements - Soft pastel glows */}
      <div className="absolute inset-0 opacity-60 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary/30 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-secondary/30 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 right-1/4 w-24 h-24 bg-warning/30 rounded-full blur-[80px] animate-pulse delay-500" />
      </div>

      {/* Floating Kawaii Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute text-2xl animate-float opacity-30"
            style={{
              top: `${particle.top}%`,
              left: `${particle.left}%`,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
            }}
          >
            {particle.emoji}
          </div>
        ))}
      </div>

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}
