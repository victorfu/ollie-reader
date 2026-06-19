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
  const shadowClass = elevated ? "shadow-elevated" : "shadow-soft";

  return (
    <div
      className={`bg-card backdrop-blur-xl backdrop-saturate-150 border border-border-hairline rounded-lg ${shadowClass} ${className}`}
    >
      {children}
    </div>
  );
}
