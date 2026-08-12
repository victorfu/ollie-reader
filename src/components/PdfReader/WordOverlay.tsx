import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { TextSelectionPayload } from "../../hooks/useTextSelection";
import type { PdfWord } from "../../types/pdf";
import {
  clientPointToPdfPoint,
  findPdfWordAtPoint,
  joinPdfWords,
  normalizePdfWords,
  pdfWordToClientRect,
  singlePdfWordText,
} from "../../utils/pdfWordSelection";

interface WordOverlayProps {
  pageWidth: number;
  pageHeight: number;
  words: PdfWord[];
  onTextSelection: (selection?: TextSelectionPayload) => void;
}

type SelectedRange = {
  start: number;
  end: number;
};

type PointerDrag = {
  pointerId: number;
  pointerType: string;
  anchorIndex: number;
  focusIndex: number;
  startX: number;
  startY: number;
};

const CLICK_DISTANCE_PX = 6;

function sortedRange(anchorIndex: number, focusIndex: number): SelectedRange {
  return {
    start: Math.min(anchorIndex, focusIndex),
    end: Math.max(anchorIndex, focusIndex),
  };
}

export const WordOverlay = memo(
  ({ pageWidth, pageHeight, words, onTextSelection }: WordOverlayProps) => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const pointerDragRef = useRef<PointerDrag | null>(null);
    const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(
      null,
    );
    const normalizedWords = useMemo(
      () => normalizePdfWords(words, pageWidth, pageHeight),
      [pageHeight, pageWidth, words],
    );

    const clearSelection = useCallback(() => {
      pointerDragRef.current = null;
      setSelectedRange(null);
    }, []);

    const wordIndexAtEvent = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>): number | null => {
        const root = rootRef.current;
        if (!root) return null;
        const point = clientPointToPdfPoint(
          event.clientX,
          event.clientY,
          root.getBoundingClientRect(),
          pageWidth,
          pageHeight,
        );
        return findPdfWordAtPoint(normalizedWords, point);
      },
      [normalizedWords, pageHeight, pageWidth],
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        event.stopPropagation();

        const index = wordIndexAtEvent(event);
        if (index === null) {
          if (event.pointerType !== "touch") {
            window.getSelection()?.removeAllRanges();
            onTextSelection();
            clearSelection();
          }
          return;
        }

        const nextDrag: PointerDrag = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          anchorIndex: index,
          focusIndex: index,
          startX: event.clientX,
          startY: event.clientY,
        };

        // A touch may become a vertical scroll. Wait for pointerup before changing
        // selection so pointercancel can leave the reader undisturbed.
        if (event.pointerType === "touch") {
          pointerDragRef.current = nextDrag;
          return;
        }

        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        // Clear the previous custom selection before storing this gesture. The
        // previous selection may belong to this same overlay, whose onClear
        // callback also resets pointerDragRef.
        onTextSelection();
        pointerDragRef.current = nextDrag;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setSelectedRange({ start: index, end: index });
      },
      [clearSelection, onTextSelection, wordIndexAtEvent],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = pointerDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.stopPropagation();
        if (drag.pointerType === "touch") return;

        event.preventDefault();
        const focusIndex = wordIndexAtEvent(event);
        if (focusIndex === null || focusIndex === drag.focusIndex) return;
        drag.focusIndex = focusIndex;
        setSelectedRange(sortedRange(drag.anchorIndex, focusIndex));
      },
      [wordIndexAtEvent],
    );

    const handlePointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = pointerDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        pointerDragRef.current = null;
        event.stopPropagation();

        const distance = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        );
        if (drag.pointerType === "touch" && distance > CLICK_DISTANCE_PX) {
          return;
        }
        if (drag.pointerType !== "touch") {
          event.preventDefault();
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }

        const hitIndex = wordIndexAtEvent(event);
        const focusIndex = hitIndex ?? drag.focusIndex;
        // Word geometry can be replaced while a captured gesture is active.
        // Never apply indices saved from the previous render to the new array.
        const anchorWord = normalizedWords[drag.anchorIndex];
        const focusWord = normalizedWords[focusIndex];
        if (!anchorWord || !focusWord) {
          clearSelection();
          onTextSelection();
          return;
        }

        const isClick = distance <= CLICK_DISTANCE_PX;
        const nextRange = isClick
          ? { start: drag.anchorIndex, end: drag.anchorIndex }
          : sortedRange(drag.anchorIndex, focusIndex);
        const text = isClick
          ? singlePdfWordText(anchorWord)
          : joinPdfWords(normalizedWords, drag.anchorIndex, focusIndex);
        if (!text) {
          clearSelection();
          onTextSelection();
          return;
        }

        const anchorIndex = isClick ? drag.anchorIndex : focusIndex;
        const getAnchorRect: TextSelectionPayload["getAnchorRect"] = () => {
          const root = rootRef.current;
          const word = normalizedWords[anchorIndex];
          if (!root || !word) return null;
          return pdfWordToClientRect(
            word,
            root.getBoundingClientRect(),
            pageWidth,
            pageHeight,
          );
        };

        window.getSelection()?.removeAllRanges();
        onTextSelection({ text, getAnchorRect, onClear: clearSelection });
        setSelectedRange(nextRange);
      },
      [
        clearSelection,
        normalizedWords,
        onTextSelection,
        pageHeight,
        pageWidth,
        wordIndexAtEvent,
      ],
    );

    const handlePointerCancel = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = pointerDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        pointerDragRef.current = null;
        event.stopPropagation();
        if (drag.pointerType !== "touch") setSelectedRange(null);
      },
      [],
    );

    if (normalizedWords.length === 0) return null;

    return (
      <div
        ref={rootRef}
        data-native-word-overlay="true"
        aria-hidden="true"
        className="absolute inset-0 z-[2] cursor-text touch-pan-y touch-pinch-zoom"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {selectedRange &&
          normalizedWords
            .slice(selectedRange.start, selectedRange.end + 1)
            .map((word, offset) => (
              <span
                key={`${selectedRange.start + offset}-${word.x0}-${word.y0}`}
                data-native-word-highlight="true"
                className="pointer-events-none absolute rounded-[2px] bg-accent/25"
                style={{
                  left: `${(word.x0 / pageWidth) * 100}%`,
                  top: `${(word.y0 / pageHeight) * 100}%`,
                  width: `${((word.x1 - word.x0) / pageWidth) * 100}%`,
                  height: `${((word.y1 - word.y0) / pageHeight) * 100}%`,
                }}
              />
            ))}
      </div>
    );
  },
);

WordOverlay.displayName = "WordOverlay";
