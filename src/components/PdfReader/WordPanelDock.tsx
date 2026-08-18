import { memo, useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import {
  clampDockWidth,
  readVocabularyDockWidth,
  writeVocabularyDockWidth,
} from "../../utils/vocabularyPanelPreferences";
import {
  WordPanelContent,
  type WordPanelSharedProps,
} from "./WordPanelContent";

/**
 * Docked shell: a right-hand rail that is a flex sibling of the PDF viewer box,
 * so it stays put while the PDF scrolls inside its own container.
 */
export const WordPanelDock = memo((props: WordPanelSharedProps) => {
  const [width, setWidth] = useState<number>(readVocabularyDockWidth);
  const [isResizing, setIsResizing] = useState(false);
  // Holds the in-flight drag's end handler so unmounting mid-drag still
  // persists the width the user dragged to (cleanup alone would drop it).
  const endDragRef = useRef<(() => void) | null>(null);

  useEffect(() => () => endDragRef.current?.(), []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const pointerId = e.pointerId;
      const grip = e.currentTarget as HTMLElement;
      grip.setPointerCapture(pointerId);

      const startX = e.clientX;
      const startWidth = width;
      let latestWidth = startWidth;
      let ended = false;
      setIsResizing(true);

      const handleMove = (ev: PointerEvent) => {
        // Dragging left (smaller clientX) widens the right-hand rail.
        latestWidth = clampDockWidth(startWidth + (startX - ev.clientX));
        setWidth(latestWidth);
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
        grip.removeEventListener("lostpointercapture", handleEnd);
        endDragRef.current = null;
        setIsResizing(false);
      };

      // pointerup releases capture, which immediately fires
      // lostpointercapture too — guard so a normal release only writes and
      // cleans up once, no matter which of the four listeners fires first.
      const handleEnd = () => {
        if (ended) return;
        ended = true;
        writeVocabularyDockWidth(latestWidth);
        cleanup();
      };

      endDragRef.current = handleEnd;
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
      grip.addEventListener("lostpointercapture", handleEnd);
    },
    [width],
  );

  return (
    <aside
      data-testid="vocab-dock"
      aria-label="生詞本"
      style={{ width }}
      className="relative hidden shrink-0 flex-col overflow-hidden rounded-xl border border-border-hairline bg-base-100 shadow-elevated lg:flex"
    >
      {/* Left-edge resize grip */}
      <div
        data-testid="vocab-dock-resize"
        onPointerDown={handleResizePointerDown}
        className={`absolute inset-y-0 left-0 z-10 w-1.5 touch-none cursor-ew-resize transition-colors ${
          isResizing ? "bg-accent/40" : "hover:bg-accent/20"
        }`}
        aria-hidden="true"
      />

      <WordPanelContent
        {...props}
        mode="docked"
        disableItemLayoutAnimation={isResizing}
      />
    </aside>
  );
});

WordPanelDock.displayName = "WordPanelDock";
