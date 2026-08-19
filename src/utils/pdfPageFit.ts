/**
 * Page-width maths for the reader's single-column viewer.
 *
 * react-pdf rasterises a page from a width alone — its height then follows from
 * the page's own aspect ratio. Rendering at the full column width therefore
 * produces a page taller than the scroll box on any short viewport, and no
 * whole page is ever visible however much surrounding chrome is trimmed. Capping
 * the width by the height the box can actually show is what makes "one page at
 * a time" possible on laptops and landscape phones.
 *
 * Pure so it can be tested without layout, which jsdom lacks.
 */

/** Below this a fitted page stops being readable; scrolling is the better trade. */
export const MIN_FIT_PAGE_WIDTH = 320;

/**
 * Vertical chrome between the scroll box and the page canvas, from the classes
 * in PdfViewer: the box's own `p-3` (24), each section's `pt-2` (8), the sticky
 * page toolbar (44 at `sm`, 56 below it via `min-h-11`) and its `mb-2` (8).
 * Deliberately the taller, mobile figure — under-reporting the chrome is what
 * makes a page miss fitting by a few pixels.
 */
export const PAGE_CHROME_PX = 96;

interface FitPageWidthInput {
  /** Width of the single column, i.e. what the page used to render at. */
  columnWidth: number;
  /** Height the scroll box can show, chrome already subtracted. */
  availableHeight: number;
  /** originalWidth / originalHeight of the document's first page. */
  pageAspectRatio: number | null;
}

/**
 * Widest render that still lets a whole page fit the visible box. Falls back to
 * the column width whenever the height or the aspect ratio is unknown — first
 * paint, jsdom, a document whose pages have not reported yet — so the viewer
 * never renders narrower than it would have without fitting.
 */
export function computeFitPageWidth({
  columnWidth,
  availableHeight,
  pageAspectRatio,
}: FitPageWidthInput): number {
  if (!Number.isFinite(columnWidth) || columnWidth <= 0) return 0;
  if (
    pageAspectRatio === null ||
    !Number.isFinite(pageAspectRatio) ||
    pageAspectRatio <= 0
  ) {
    return columnWidth;
  }
  if (!Number.isFinite(availableHeight) || availableHeight <= 0) {
    return columnWidth;
  }

  const heightBoundWidth = availableHeight * pageAspectRatio;
  // A phone narrower than the readability floor keeps the column width: the
  // floor may never widen a page past the column it has to sit in.
  const floor = Math.min(columnWidth, MIN_FIT_PAGE_WIDTH);
  return Math.floor(Math.max(floor, Math.min(columnWidth, heightBoundWidth)));
}
