import type { ReactNode } from "react";

interface HintTextProps {
  /** The Chinese meaning shown in the tooltip. */
  hint: string;
  children: ReactNode;
}

/**
 * English text whose Chinese meaning appears as a tooltip on hover. Uses the
 * native `title` so it adds no layout, works inside buttons and links, and is
 * never clipped by a scrolling or `overflow-hidden` container.
 */
export function HintText({ hint, children }: HintTextProps) {
  return <span title={hint}>{children}</span>;
}
