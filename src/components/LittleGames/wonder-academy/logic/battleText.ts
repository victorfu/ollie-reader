export type EffectivenessBadge = {
  label: string;
  tone: "strong" | "weak";
};

export function effectivenessBadge(effectiveness: number): EffectivenessBadge | null {
  if (effectiveness >= 2) return { label: "剋制 2x", tone: "strong" };
  if (effectiveness <= 0.5) return { label: "不利 0.5x", tone: "weak" };
  return null;
}
