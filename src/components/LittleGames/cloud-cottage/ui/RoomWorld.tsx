import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { getFurniture } from "../data/furniture";
import type {
  FurnitureId,
  PetSaveV1,
  PlacedFurniture,
} from "../types";
import {
  COTTAGE_ROOM_EMPTY_SRC,
  FLOOR_SURFACE_CLASSES,
  FURNITURE_VISUALS,
  WALLPAPER_SURFACE_CLASSES,
} from "./cottageAssets";

export type RoomFurniturePointerHandler = (
  event: ReactPointerEvent<HTMLButtonElement>,
  placement: PlacedFurniture,
  index: number,
) => void;

export type RoomFurnitureKeyboardHandler = (
  event: ReactKeyboardEvent<HTMLButtonElement>,
  placement: PlacedFurniture,
  index: number,
) => void;

export type RoomWorldProps = {
  room: PetSaveV1["room"];
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
  editor?: boolean;
  selectedId?: FurnitureId | null;
  /** A transient drag position. It replaces the matching item without saving. */
  previewPlacement?: PlacedFurniture | null;
  onSelect?: (furnitureId: FurnitureId) => void;
  onFurniturePointerDown?: RoomFurniturePointerHandler;
  onFurniturePointerMove?: RoomFurniturePointerHandler;
  onFurniturePointerUp?: RoomFurniturePointerHandler;
  onFurnitureKeyDown?: RoomFurnitureKeyboardHandler;
};

function safePercentage(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

function withPreview(
  placed: readonly PlacedFurniture[],
  preview: PlacedFurniture | null | undefined,
): PlacedFurniture[] {
  if (!preview) return [...placed];
  const existingIndex = placed.findIndex((item) => item.id === preview.id);
  if (existingIndex < 0) return [...placed, preview];
  return placed.map((item, index) => index === existingIndex ? preview : item);
}

export function RoomWorld({
  room,
  className = "",
  ariaLabel = "大耳狗的雲朵小窩房間",
  children,
  editor = false,
  selectedId = null,
  previewPlacement = null,
  onSelect,
  onFurniturePointerDown,
  onFurniturePointerMove,
  onFurniturePointerUp,
  onFurnitureKeyDown,
}: RoomWorldProps) {
  const placements = withPreview(room.placed, previewPlacement);

  return (
    <div
      className={`relative isolate aspect-[3/2] w-full overflow-hidden rounded-[20px] border border-white/60 bg-sky-100 shadow-[0_20px_55px_rgba(56,115,160,0.2)] ${className}`}
      role="group"
      aria-label={ariaLabel}
      data-room-world
      data-wallpaper-id={room.wallpaperId}
      data-floor-id={room.floorId}
    >
      <img
        src={COTTAGE_ROOM_EMPTY_SRC}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        draggable={false}
      />

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[64%] opacity-75 mix-blend-multiply ${WALLPAPER_SURFACE_CLASSES[room.wallpaperId]}`}
        data-room-zone="wall"
        data-wallpaper-id={room.wallpaperId}
        aria-hidden="true"
      />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[38%] opacity-80 mix-blend-multiply ${FLOOR_SURFACE_CLASSES[room.floorId]}`}
        data-room-zone="floor"
        data-floor-id={room.floorId}
        aria-hidden="true"
      />

      {placements.map((placement, index) => {
        const visual = FURNITURE_VISUALS[placement.id];
        const definition = getFurniture(placement.id);
        const isSelected = selectedId === placement.id;
        const style = {
          left: `${safePercentage(placement.x + (visual.offsetXPercent ?? 0))}%`,
          top: `${safePercentage(placement.y + (visual.offsetYPercent ?? 0))}%`,
          width: `${visual.widthPercent}%`,
          zIndex: index + 10,
          transform: "translate(-50%, -50%)",
        };
        const image = (
          <img
            src={visual.src}
            alt=""
            className="pointer-events-none block h-auto w-full select-none drop-shadow-[0_8px_7px_rgba(52,93,118,0.18)]"
            draggable={false}
          />
        );

        if (!editor) {
          return (
            <div
              key={placement.id}
              className="pointer-events-none absolute"
              style={style}
              data-placed-furniture-id={placement.id}
              data-placement-index={index}
              data-furniture-zone={placement.zone}
              aria-hidden="true"
            >
              {image}
            </div>
          );
        }

        return (
          <button
            key={placement.id}
            type="button"
            className={`absolute min-h-11 min-w-11 touch-none rounded-[12px] p-0 transition-[filter,outline,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/95 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-500 ${
              isSelected
                ? "outline-4 outline-offset-4 outline-sky-500 drop-shadow-[0_8px_12px_rgba(14,165,233,0.35)]"
                : "outline-none hover:brightness-105"
            }`}
            style={style}
            onClick={() => onSelect?.(placement.id)}
            onPointerDown={(event) => onFurniturePointerDown?.(event, placement, index)}
            onPointerMove={(event) => onFurniturePointerMove?.(event, placement, index)}
            onPointerUp={(event) => onFurniturePointerUp?.(event, placement, index)}
            onPointerCancel={(event) => onFurniturePointerUp?.(event, placement, index)}
            onKeyDown={(event) => onFurnitureKeyDown?.(event, placement, index)}
            aria-label={`移動${definition?.nameZh ?? placement.id}${definition ? `（${definition.nameEn}）` : ""}`}
            aria-pressed={isSelected}
            data-placed-furniture-id={placement.id}
            data-placement-index={index}
            data-furniture-zone={placement.zone}
          >
            {image}
            <span
              className={`pointer-events-none absolute -right-2 -top-2 size-5 rounded-full border-2 border-white bg-sky-500 shadow-md ${isSelected ? "block" : "hidden"}`}
              aria-hidden="true"
            />
          </button>
        );
      })}

      {children}
    </div>
  );
}
