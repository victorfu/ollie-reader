import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Play } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import { layerSentences, sentenceRects, type Sentence } from "../../utils/pdfSentences";

type Hint = { layer: HTMLElement; sentence: Sentence; rects: DOMRect[]; left: number; top: number };

export function SentenceHover({ containerRef, onSpeak, onSentenceSpeak, layoutKey }: {
  containerRef: RefObject<HTMLDivElement | null>;
  onSpeak: (text: string) => void;
  onSentenceSpeak?: (sentence: Sentence, layer: HTMLElement) => void;
  layoutKey: string;
}) {
  const { t } = useLanguage();
  const [hint, setHint] = useState<Hint | null>(null);
  const hintRef = useRef<Hint | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !window.matchMedia) return;
    const media = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
    let dragging = false;
    let frame = 0;
    let switchTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelSwitch = () => { clearTimeout(switchTimer); };
    const clear = () => { cancelSwitch(); hintRef.current = null; setHint(null); };
    const selected = () => { const s = window.getSelection(); return !!s && !s.isCollapsed; };
    const move = (event: PointerEvent) => {
      // Only switch after the pointer settles on another sentence. Any motion
      // cancels the pending switch, including motion into the portal button.
      cancelAnimationFrame(frame);
      cancelSwitch();
      if (event.pointerType === "touch" || !media.matches || dragging || event.buttons || selected()) { clear(); return; }
      if (buttonRef.current?.contains(event.target as Node)) { cancelSwitch(); return; }
      const x = event.clientX, y = event.clientY;
      frame = requestAnimationFrame(() => {
        const target = event.target instanceof Element ? event.target : null;
        const layer = target?.closest<HTMLElement>(".textLayer");
        const surface = layer?.closest<HTMLElement>("[data-pdf-page-surface]");
        // Keep the chosen sentence pinned across whitespace, line gaps and
        // the play button. No narrow mouse corridor or countdown to reach Play.
        if (!layer || !surface || !container.contains(layer)) return;
        const bounds = container.getBoundingClientRect();
        for (const sentence of layerSentences(layer)) {
          const rects = sentenceRects(sentence);
          if (!rects.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) continue;
          if (!rects.length || rects[0].top < bounds.top || rects[0].bottom > bounds.bottom) return;
          const visibleRects = rects.map(r => new DOMRect(r.left, Math.max(r.top, bounds.top), r.width, Math.min(r.bottom, bounds.bottom) - Math.max(r.top, bounds.top))).filter(r => r.height > 0);
          // Anchor to the sentence itself, not the page gutter. Keep the
          // control just above its first word so it does not cover that word.
          const next = {
            layer,
            sentence,
            rects: visibleRects,
            left: Math.min(rects[0].left, window.innerWidth - 40),
            top: Math.max(4, rects[0].top - 38),
          };
          const show = () => { hintRef.current = next; setHint(next); };
          // Let users cross other text on the way to Play without
          // accidentally changing the sentence attached to its play button.
          if (!hintRef.current || hintRef.current.sentence === sentence) {
            cancelSwitch(); show();
          } else {
            switchTimer = setTimeout(show, 250);
          }
          return;
        }
        // Whitespace inside the text layer is also a safe route to Play.
      });
    };
    const down = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      dragging = true; cancelAnimationFrame(frame); clear();
    };
    const up = () => { dragging = false; };
    const selectionChange = () => { if (selected()) { cancelAnimationFrame(frame); clear(); } };
    const invalidate = () => { cancelAnimationFrame(frame); clear(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") invalidate(); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    document.addEventListener("selectionchange", selectionChange);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", invalidate, true);
    window.addEventListener("resize", invalidate);
    media.addEventListener("change", invalidate);
    return () => {
      cancelSwitch();
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.removeEventListener("selectionchange", selectionChange);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", invalidate, true);
      window.removeEventListener("resize", invalidate);
      media.removeEventListener("change", invalidate);
    };
  }, [containerRef, layoutKey]);
  if (!hint) return null;
  return createPortal(<>
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {hint.rects.map((r, i) => <span key={i} className="absolute rounded-sm bg-accent/10"
        style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />)}
    </div>
    <button ref={buttonRef} type="button" aria-label={t("reader.sentence.speak")}
      title={hint.sentence.text}
      className="fixed z-30 flex size-8 items-center justify-center rounded-md border border-border-hairline bg-base-100 text-accent shadow-sm hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ left: hint.left, top: hint.top }}
      onMouseDown={event => event.preventDefault()}
      onClick={() => {
        if (window.getSelection()?.isCollapsed === false) return;
        if (onSentenceSpeak) onSentenceSpeak(hint.sentence, hint.layer);
        else onSpeak(hint.sentence.text);
      }}><Play className="size-4" fill="currentColor" aria-hidden="true" /></button>
  </>, document.body);
}
