import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { layerSentences, sentenceRects } from "../../utils/pdfSentences";

export type SentencePlaybackTarget = { page: number; index: number; text: string };

/** A visual overlay only: never add/remove native selection ranges. */
export function SentencePlaybackHighlight({ containerRef, target }: {
  containerRef: RefObject<HTMLDivElement | null>;
  target: SentencePlaybackTarget;
}) {
  const [rects, setRects] = useState<DOMRect[]>([]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const measure = () => {
      const layer = container.querySelector<HTMLElement>(`[data-page-number="${target.page}"] .textLayer`);
      const sentence = layer && layerSentences(layer)[target.index];
      const bounds = container.getBoundingClientRect();
      const next = sentence?.text === target.text ? sentenceRects(sentence).map(r => {
        const left = Math.max(r.left, bounds.left);
        const top = Math.max(r.top, bounds.top);
        return new DOMRect(left, top, Math.min(r.right, bounds.right) - left, Math.min(r.bottom, bounds.bottom) - top);
      }).filter(r => r.width > 0 && r.height > 0) : [];
      setRects(next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    schedule();
    // Re-resolve by page and sentence index after PDF.js replaces text nodes.
    const observer = new MutationObserver(schedule);
    observer.observe(container, { childList: true, subtree: true, attributes: true });
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    resize?.observe(container);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize?.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, target]);
  return createPortal(
    <div data-testid="sentence-playback-highlight" aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {rects.map((r, i) => <span key={i}
        className="absolute rounded-sm bg-success/20 ring-1 ring-inset ring-success/30"
        style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />)}
    </div>, document.body,
  );
}
