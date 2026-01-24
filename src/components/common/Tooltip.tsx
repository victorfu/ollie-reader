interface TooltipProps {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

export function Tooltip({
  content,
  position = "top",
  children,
}: TooltipProps) {
  return (
    <div className={`tooltip tooltip-${position}`} data-tip={content}>
      {children}
    </div>
  );
}
