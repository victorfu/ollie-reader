import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Box } from "../../types/questionBank";
import {
  boxFromPoints,
  isBoxTooSmall,
  moveBox,
  resizeBox,
  sameBox,
  toRelativePoint,
  type Corner,
  type Point,
} from "./boxGeometry";

export interface CanvasBox {
  key: string;
  box: Box;
  label?: string;
}

type Drag =
  | { type: "draw"; start: Point; current: Point }
  | { type: "move"; key: string; origin: Box; start: Point; current: Point }
  | { type: "resize"; key: string; corner: Corner; origin: Box; current: Point };

interface CropCanvasProps {
  imageUrl: string | undefined;
  imageAlt: string;
  mode: "question" | "mask";
  questionBoxes: readonly CanvasBox[];
  maskBoxes: readonly CanvasBox[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onCreate: (box: Box) => void;
  onChange: (key: string, box: Box) => void;
}

const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

const CORNER_CLASS: Record<Corner, string> = {
  nw: "left-0 top-0 cursor-nwse-resize",
  ne: "left-full top-0 cursor-nesw-resize",
  sw: "left-0 top-full cursor-nesw-resize",
  se: "left-full top-full cursor-nwse-resize",
};

function dragResult(drag: Drag): Box {
  switch (drag.type) {
    case "draw":
      return boxFromPoints(drag.start, drag.current);
    case "move":
      return moveBox(drag.origin, drag.current.x - drag.start.x, drag.current.y - drag.start.y);
    case "resize":
      return resizeBox(drag.origin, drag.corner, drag.current);
  }
}

function boxStyle(box: Box) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };
}

function capturePointer(event: ReactPointerEvent<HTMLElement>): void {
  if (event.pointerId === undefined) return;
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // 不支援 pointer capture 的環境（如 jsdom）直接略過
  }
}

/**
 * 頁面大圖上的框。框用絕對定位的 HTML div（百分比位置、px 把手），
 * 不用非等比縮放的 SVG，線條與把手才不會變形（spec §8.2）。
 */
export function CropCanvas({
  imageUrl,
  imageAlt,
  mode,
  questionBoxes,
  maskBoxes,
  selectedKey,
  onSelect,
  onCreate,
  onChange,
}: CropCanvasProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const activeBoxes = mode === "question" ? questionBoxes : maskBoxes;
  const passiveBoxes = mode === "question" ? maskBoxes : questionBoxes;

  const pointFrom = (event: ReactPointerEvent): Point => {
    const rect = overlayRef.current?.getBoundingClientRect();
    return rect ? toRelativePoint(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
  };

  const startDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    capturePointer(event);
    onSelect(null);
    const point = pointFrom(event);
    setDrag({ type: "draw", start: point, current: point });
  };

  const startMove = (item: CanvasBox) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    capturePointer(event);
    onSelect(item.key);
    const point = pointFrom(event);
    setDrag({ type: "move", key: item.key, origin: item.box, start: point, current: point });
  };

  const startResize =
    (item: CanvasBox, corner: Corner) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      capturePointer(event);
      setDrag({ type: "resize", key: item.key, corner, origin: item.box, current: pointFrom(event) });
    };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({ ...drag, current: pointFrom(event) });
  };

  const handleUp = () => {
    if (!drag) return;
    const box = dragResult(drag);
    setDrag(null);
    if (isBoxTooSmall(box)) return;
    if (drag.type === "draw") {
      onCreate(box);
    } else if (!sameBox(box, drag.origin)) {
      onChange(drag.key, box);
    }
  };

  const drawPreview = drag?.type === "draw" ? dragResult(drag) : null;

  return (
    <div className="relative select-none">
      {imageUrl ? (
        <img src={imageUrl} alt={imageAlt} draggable={false} className="block h-auto w-full" />
      ) : (
        <div className="aspect-[3/4] w-full animate-pulse bg-base-200" />
      )}
      <div
        ref={overlayRef}
        data-testid="crop-overlay"
        className={`absolute inset-0 touch-none ${mode === "question" ? "cursor-crosshair" : "cursor-cell"}`}
        onPointerDown={startDraw}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => setDrag(null)}
      >
        {passiveBoxes.map((item) => (
          <div
            key={item.key}
            className={`pointer-events-none absolute ${
              mode === "question"
                ? "border border-dashed border-warning bg-white/60"
                : "border border-primary/40"
            }`}
            style={boxStyle(item.box)}
          />
        ))}

        {activeBoxes.map((item) => {
          const selected = item.key === selectedKey;
          const box = drag && drag.type !== "draw" && drag.key === item.key ? dragResult(drag) : item.box;
          const look =
            mode === "question"
              ? selected
                ? "border-primary bg-primary/20"
                : "border-primary/70 bg-primary/10"
              : `border-dashed border-warning ${selected ? "bg-white/90" : "bg-white/70"}`;
          return (
            <div
              key={item.key}
              data-box-key={item.key}
              className={`absolute cursor-move border-2 ${look}`}
              style={boxStyle(box)}
              onPointerDown={startMove(item)}
            >
              {item.label && (
                <span className="pointer-events-none absolute left-0 top-0 rounded-br bg-primary px-1 text-xs font-semibold text-primary-content">
                  {item.label}
                </span>
              )}
              {selected &&
                CORNERS.map((corner) => (
                  <div
                    key={corner}
                    data-corner={corner}
                    className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center ${CORNER_CLASS[corner]}`}
                    onPointerDown={startResize(item, corner)}
                  >
                    <span className="size-3 rounded-sm border-2 border-primary bg-white" />
                  </div>
                ))}
            </div>
          );
        })}

        {drawPreview && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-primary"
            style={boxStyle(drawPreview)}
          />
        )}
      </div>
    </div>
  );
}
