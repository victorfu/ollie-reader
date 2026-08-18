/**
 * Scroll-position maths for the PDF reader's single-column viewer.
 *
 * Every mounted page is rendered at the measured column width, so any change to
 * that width (opening or resizing the docked vocabulary rail, resizing the
 * window) re-renders the whole document at a different total height. A scroll
 * offset preserved in pixels would then point somewhere else entirely, so the
 * position is carried across as a fraction of the document instead.
 *
 * These are pure so they can be tested without layout, which jsdom lacks.
 */

/** Fraction of the document's total height that sits above the viewport. */
export function computeScrollRatio(
  scrollTop: number,
  scrollHeight: number,
): number {
  if (!Number.isFinite(scrollTop) || !Number.isFinite(scrollHeight)) return 0;
  if (scrollTop <= 0 || scrollHeight <= 0) return 0;
  return Math.min(scrollTop / scrollHeight, 1);
}

/**
 * Scroll offset that puts the same fraction of a re-laid-out document above the
 * viewport, clamped to what the container can actually scroll to.
 */
export function computeRestoredScrollTop(
  ratio: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight)) return 0;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  return Math.min(Math.max(ratio * scrollHeight, 0), maxScrollTop);
}
