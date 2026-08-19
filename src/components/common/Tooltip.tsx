interface TooltipProps {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

/**
 * Tailwind only emits the DaisyUI classes it can find as literal strings in the
 * source, so the placement is looked up rather than interpolated: a
 * `tooltip-${position}` template produced no rule at all, leaving every tooltip
 * at DaisyUI's default top placement whatever the caller asked for.
 */
const POSITION_CLASS = {
  top: "tooltip-top",
  bottom: "tooltip-bottom",
  left: "tooltip-left",
  right: "tooltip-right",
} as const;

export function Tooltip({
  content,
  position = "top",
  children,
}: TooltipProps) {
  return (
    <div className={`tooltip ${POSITION_CLASS[position]}`} data-tip={content}>
      {children}
    </div>
  );
}
