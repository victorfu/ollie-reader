import type { CefrInfo } from "../../types/wordPractice";

interface CefrBadgeProps {
  info: CefrInfo;
}

// Both share the same box (the solid one has a transparent border) so a row
// does not change height between the two. A list level is a solid pill; an AI
// estimate is dashed and muted, with a leading "≈", so it reads as a guess.
const LIST_STYLE = "border border-transparent bg-base-content/10 text-base-content/80";
const ESTIMATE_STYLE = "border border-dashed border-base-content/40 text-muted-foreground";

/** A small CEFR level pill: "B1" for a word-list level, "≈B1" for an AI estimate. */
export const CefrBadge = ({ info }: CefrBadgeProps) => {
  const estimated = info.source === "ai";
  return (
    <span
      role="img"
      aria-label={estimated ? `CEFR 估計 ${info.level}` : `CEFR ${info.level}`}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-1.5 text-[11px] font-semibold leading-4 tabular-nums ${
        estimated ? ESTIMATE_STYLE : LIST_STYLE
      }`}
    >
      {estimated ? "≈" : ""}
      {info.level}
    </span>
  );
};
