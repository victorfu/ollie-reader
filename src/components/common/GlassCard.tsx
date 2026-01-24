interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}

export function GlassCard({
  children,
  className = "",
  elevated = false,
}: GlassCardProps) {
  const shadowClass = elevated ? "shadow-lg" : "shadow-sm";

  return (
    <div
      className={`bg-card backdrop-blur-glass backdrop-saturate-glass border border-border-hairline rounded-lg ${shadowClass} ${className}`}
    >
      {children}
    </div>
  );
}
