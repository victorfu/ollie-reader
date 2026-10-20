/**
 * Shared classes for the trailing action cluster on feed rows
 * (VocabularyRow, SentenceRow).
 *
 * Touch screens have no hover, so the actions stay visible there and only
 * fade in on hover for precise pointers. An active speak button
 * (aria-pressed) keeps the cluster visible while audio plays.
 */
export const ROW_ACTIONS_CLASS = [
  "flex shrink-0 items-center gap-0.5 self-center transition-opacity",
  "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100",
  "pointer-fine:focus-within:opacity-100 pointer-fine:has-[[aria-pressed=true]]:opacity-100",
].join(" ");

// 44px target on touch screens, compact with a mouse.
export const ROW_DELETE_CLASS =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-error/60 transition-colors hover:bg-error/10 hover:text-error active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error pointer-coarse:size-11";

export const ROW_DELETE_ICON_CLASS = "size-4 pointer-coarse:size-5";
