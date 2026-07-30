import {
  Check,
  Layers3,
  PackagePlus,
  Paintbrush,
  RotateCcw,
  Save as SaveIcon,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FLOORS, FURNITURE, WALLPAPERS, getFurniture } from "../data/furniture";
import {
  applyPersonalizationAction,
  type PersonalizationAction,
} from "../logic/personalization";
import type {
  FloorId,
  FurnitureId,
  FurnitureZone,
  PetSaveV1,
  PlacedFurniture,
  WallpaperId,
} from "../types";
import { RoomWorld } from "./RoomWorld";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const ZONE_BOUNDS: Record<
  FurnitureZone,
  { minX: number; maxX: number; minY: number; maxY: number }
> = {
  wall: { minX: 7, maxX: 93, minY: 12, maxY: 53 },
  floor: { minX: 7, maxX: 93, minY: 63, maxY: 89 },
};

const FURNITURE_EMOJI: Record<FurnitureId, string> = {
  "cloud-bed": "🛏️",
  lamp: "💡",
  plant: "🪴",
  picture: "🖼️",
  rug: "🧶",
  table: "🫖",
  curtain: "🪟",
  sofa: "🛋️",
  bookshelf: "📚",
  "flower-gift": "🌼",
  "clover-plant": "🍀",
  "star-hanging": "⭐",
  "rainbow-picture": "🌈",
  "cloud-frame": "☁️",
};

const WALLPAPER_SWATCH: Record<WallpaperId, string> = {
  "cloud-blue": "bg-gradient-to-br from-sky-100 to-blue-200",
  "starry-night": "bg-gradient-to-br from-indigo-800 to-violet-500",
  "candy-stripes": "bg-gradient-to-br from-pink-200 via-white to-sky-200",
  forest: "bg-gradient-to-br from-emerald-200 to-green-600",
};

const FLOOR_SWATCH: Record<FloorId, string> = {
  "cream-wood": "bg-gradient-to-br from-amber-50 to-amber-200",
  "cloud-carpet": "bg-gradient-to-br from-white to-sky-200",
  "frosting-check": "bg-gradient-to-br from-pink-100 to-violet-200",
};

type InventoryTab = "furniture" | "wallpaper" | "floor";

type DragPreview = {
  pointerId: number;
  placement: PlacedFurniture;
};

export type RoomEditorProps = {
  save: PetSaveV1;
  busy: boolean;
  onCancel: () => void;
  onPreviewChange?: (room: PetSaveV1["room"] | null) => void;
  onSave: (actions: PersonalizationAction[]) => Promise<void>;
};

function cloneRoom(room: PetSaveV1["room"]): PetSaveV1["room"] {
  return {
    wallpaperId: room.wallpaperId,
    floorId: room.floorId,
    placed: room.placed.map((item) => ({ ...item })),
  };
}

function roomsEqual(
  first: PetSaveV1["room"],
  second: PetSaveV1["room"],
): boolean {
  if (
    first.wallpaperId !== second.wallpaperId ||
    first.floorId !== second.floorId ||
    first.placed.length !== second.placed.length
  ) {
    return false;
  }
  return first.placed.every((item, index) => {
    const other = second.placed[index];
    return (
      other !== undefined &&
      item.id === other.id &&
      item.x === other.x &&
      item.y === other.y &&
      item.zone === other.zone
    );
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampPlacement(
  furnitureId: FurnitureId,
  x: number,
  y: number,
): PlacedFurniture | null {
  const furniture = getFurniture(furnitureId);
  if (!furniture) return null;
  const bounds = ZONE_BOUNDS[furniture.zone];
  return {
    id: furniture.id,
    x: Math.round(clamp(x, bounds.minX, bounds.maxX) * 100) / 100,
    y: Math.round(clamp(y, bounds.minY, bounds.maxY) * 100) / 100,
    zone: furniture.zone,
  };
}

function hasSamePosition(
  first: PlacedFurniture,
  second: PlacedFurniture,
): boolean {
  return (
    first.x === second.x &&
    first.y === second.y &&
    first.zone === second.zone
  );
}

/**
 * Derives a compact, deterministic transition from the entrance snapshot to
 * the draft. Moving an item appends it in the domain model, so a preserved
 * prefix plus an ordered suffix also recreates the exact visual z-order.
 */
function buildRoomActions(
  originalRoom: PetSaveV1["room"],
  draftRoom: PetSaveV1["room"],
): PersonalizationAction[] {
  const actions: PersonalizationAction[] = [];
  const targetIds = new Set(draftRoom.placed.map((item) => item.id));

  for (const original of originalRoom.placed) {
    if (original.id !== "cloud-bed" && !targetIds.has(original.id)) {
      actions.push({ type: "remove-furniture", furnitureId: original.id });
    }
  }

  const remainingOriginal = originalRoom.placed.filter((item) =>
    targetIds.has(item.id),
  );
  const originalById = new Map(
    remainingOriginal.map((item) => [item.id, item] as const),
  );

  let preservedPrefixLength = 0;
  for (let length = draftRoom.placed.length; length >= 0; length -= 1) {
    const prefix = draftRoom.placed.slice(0, length);
    const prefixIds = new Set(prefix.map((item) => item.id));
    const everyPositionIsPreserved = prefix.every((item) => {
      const original = originalById.get(item.id);
      return original !== undefined && hasSamePosition(original, item);
    });
    if (!everyPositionIsPreserved) continue;
    const originalPrefixOrder = remainingOriginal
      .filter((item) => prefixIds.has(item.id))
      .map((item) => item.id);
    if (
      originalPrefixOrder.length === prefix.length &&
      originalPrefixOrder.every((id, index) => id === prefix[index]?.id)
    ) {
      preservedPrefixLength = length;
      break;
    }
  }

  for (const placement of draftRoom.placed.slice(preservedPrefixLength)) {
    const original = originalById.get(placement.id);
    if (!original) {
      actions.push({
        type: "add-furniture",
        furnitureId: placement.id,
        x: placement.x,
        y: placement.y,
        zone: placement.zone,
      });
      continue;
    }

    if (hasSamePosition(original, placement)) {
      const temporaryX = placement.x >= 99.99
        ? Math.max(0, placement.x - 0.01)
        : Math.min(100, placement.x + 0.01);
      actions.push({
        type: "move-furniture",
        furnitureId: placement.id,
        x: Math.round(temporaryX * 100) / 100,
        y: placement.y,
        zone: placement.zone,
      });
    }
    actions.push({
      type: "move-furniture",
      furnitureId: placement.id,
      x: placement.x,
      y: placement.y,
      zone: placement.zone,
    });
  }

  if (draftRoom.wallpaperId !== originalRoom.wallpaperId) {
    actions.push({
      type: "select-wallpaper",
      wallpaperId: draftRoom.wallpaperId,
    });
  }
  if (draftRoom.floorId !== originalRoom.floorId) {
    actions.push({ type: "select-floor", floorId: draftRoom.floorId });
  }
  return actions;
}

function getDefaultPlacement(
  zone: FurnitureZone,
  room: PetSaveV1["room"],
): { x: number; y: number } {
  const occupied = room.placed.filter((item) => item.zone === zone).length;
  const columnOffset = ((occupied % 3) - 1) * 13;
  const rowOffset = (Math.floor(occupied / 3) % 2) * 7;
  return zone === "wall"
    ? { x: 50 + columnOffset, y: 29 + rowOffset }
    : { x: 50 + columnOffset, y: 72 + rowOffset };
}

function positionDescription(item: PlacedFurniture): string {
  const zone = item.zone === "wall" ? "牆面區" : "地板區";
  return `${zone}，橫向 ${Math.round(item.x)}%，縱向 ${Math.round(item.y)}%`;
}

export function RoomEditor({
  save,
  busy,
  onCancel,
  onPreviewChange,
  onSave,
}: RoomEditorProps) {
  const originalRoomRef = useRef(cloneRoom(save.room));
  const draftRoomRef = useRef(cloneRoom(save.room));
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  const onCancelRef = useRef(onCancel);
  const controlsBusyRef = useRef(busy);
  const confirmCancelRef = useRef(false);
  const [draftRoom, setDraftRoom] = useState(() => cloneRoom(save.room));
  const [selectedId, setSelectedId] = useState<FurnitureId | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTab>("furniture");
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [announcement, setAnnouncement] = useState("已開啟房間佈置模式");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dirty = !roomsEqual(originalRoomRef.current, draftRoom);
  const saveActions = useMemo(
    () => buildRoomActions(originalRoomRef.current, draftRoom),
    [draftRoom],
  );
  const controlsBusy = busy || submitting;
  controlsBusyRef.current = controlsBusy;
  confirmCancelRef.current = confirmCancel;

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  const requestCancel = useCallback(() => {
    if (controlsBusyRef.current) return;
    if (roomsEqual(originalRoomRef.current, draftRoomRef.current)) {
      onCancelRef.current();
      return;
    }
    setConfirmCancel(true);
  }, []);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const overlay = overlayRef.current;
    const inertSiblings = overlay?.parentElement
      ? Array.from(overlay.parentElement.children)
          .filter(
            (element): element is HTMLElement =>
              element instanceof HTMLElement && element !== overlay,
          )
          .map((element) => ({
            element,
            hadInert: element.hasAttribute("inert"),
            ariaHidden: element.getAttribute("aria-hidden"),
          }))
      : [];
    for (const { element } of inertSiblings) {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (confirmCancelRef.current) setConfirmCancel(false);
        else requestCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusScope =
        dialogRef.current.querySelector<HTMLElement>("[role='alertdialog']") ??
        dialogRef.current;
      const focusable = Array.from(
        focusScope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.tabIndex >= 0 && !element.hidden);
      if (focusable.length === 0) {
        event.preventDefault();
        focusScope.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !focusScope.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const { element, hadInert, ariaHidden } of inertSiblings) {
        if (!hadInert) element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [requestCancel]);

  const ownedFurniture = useMemo(
    () => FURNITURE.filter((item) => save.inventory.furniture.includes(item.id)),
    [save.inventory.furniture],
  );
  const ownedWallpapers = useMemo(
    () => WALLPAPERS.filter((item) => save.inventory.wallpapers.includes(item.id)),
    [save.inventory.wallpapers],
  );
  const ownedFloors = useMemo(
    () => FLOORS.filter((item) => save.inventory.floors.includes(item.id)),
    [save.inventory.floors],
  );
  const placedIds = useMemo(
    () => new Set(draftRoom.placed.map((item) => item.id)),
    [draftRoom.placed],
  );

  const previewRoom = useMemo<PetSaveV1["room"]>(() => {
    if (!dragPreview) return draftRoom;
    return {
      ...draftRoom,
      placed: [
        ...draftRoom.placed.filter(
          (item) => item.id !== dragPreview.placement.id,
        ),
        dragPreview.placement,
      ],
    };
  }, [draftRoom, dragPreview]);

  useEffect(() => {
    onPreviewChange?.(previewRoom);
  }, [onPreviewChange, previewRoom]);

  useEffect(
    () => () => onPreviewChange?.(null),
    [onPreviewChange],
  );

  const selectedPlacement = selectedId
    ? previewRoom.placed.find((item) => item.id === selectedId)
    : undefined;
  const selectedDefinition = selectedId ? getFurniture(selectedId) : undefined;

  const setPreview = useCallback((preview: DragPreview | null) => {
    dragPreviewRef.current = preview;
    setDragPreview(preview);
  }, []);

  const applyDraftAction = useCallback(
    (action: PersonalizationAction, message: string): boolean => {
      const result = applyPersonalizationAction(
        { ...save, room: draftRoomRef.current },
        action,
      );
      if (!result.applied) {
        setAnnouncement(`沒有變更：${message}`);
        return false;
      }
      const nextRoom = cloneRoom(result.save.room);
      draftRoomRef.current = nextRoom;
      setDraftRoom(nextRoom);
      setAnnouncement(message);
      return true;
    },
    [save],
  );

  const handleAddFurniture = useCallback(
    (furnitureId: FurnitureId) => {
      if (controlsBusy || placedIds.has(furnitureId)) return;
      const furniture = getFurniture(furnitureId);
      if (!furniture) return;
      const position = getDefaultPlacement(furniture.zone, draftRoomRef.current);
      const placement = clampPlacement(furniture.id, position.x, position.y);
      if (!placement) return;
      const applied = applyDraftAction(
        {
          type: "add-furniture",
          furnitureId: furniture.id,
          x: placement.x,
          y: placement.y,
          zone: placement.zone,
        },
        `已將${furniture.nameZh}放到${positionDescription(placement)}`,
      );
      if (applied) setSelectedId(furniture.id);
    },
    [applyDraftAction, controlsBusy, placedIds],
  );

  const handleRemoveFurniture = useCallback(
    (furnitureId: FurnitureId) => {
      const furniture = getFurniture(furnitureId);
      if (!furniture || controlsBusy) return;
      if (furnitureId === "cloud-bed") {
        setAnnouncement("雲朵床是小屋的重要家具，可以移動但不能收起");
        return;
      }
      const applied = applyDraftAction(
        { type: "remove-furniture", furnitureId },
        `已將${furniture.nameZh}收回庫存`,
      );
      if (applied) setSelectedId(null);
    },
    [applyDraftAction, controlsBusy],
  );

  const handlePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      item: PlacedFurniture,
    ) => {
      if (controlsBusy || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedId(item.id);
      setPreview({ pointerId: event.pointerId, placement: { ...item } });
    },
    [controlsBusy, setPreview],
  );

  const handlePointerMove = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      item: PlacedFurniture,
    ) => {
      const current = dragPreviewRef.current;
      if (
        !current ||
        current.pointerId !== event.pointerId ||
        current.placement.id !== item.id
      ) {
        return;
      }
      const roomWorld = event.currentTarget.closest<HTMLElement>("[data-room-world]");
      if (!roomWorld) return;
      const rect = roomWorld.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const next = clampPlacement(
        item.id,
        ((event.clientX - rect.left) / rect.width) * 100,
        ((event.clientY - rect.top) / rect.height) * 100,
      );
      if (!next) return;
      event.preventDefault();
      setPreview({ pointerId: event.pointerId, placement: next });
    },
    [setPreview],
  );

  const handlePointerUp = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      item: PlacedFurniture,
    ) => {
      const current = dragPreviewRef.current;
      if (
        !current ||
        current.pointerId !== event.pointerId ||
        current.placement.id !== item.id
      ) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setPreview(null);
      if (event.type === "pointercancel") {
        setAnnouncement("已取消這次拖曳，家具位置沒有改變");
        return;
      }
      const next = current.placement;
      const furniture = getFurniture(item.id);
      if (!furniture) return;
      applyDraftAction(
        {
          type: "move-furniture",
          furnitureId: next.id,
          x: next.x,
          y: next.y,
          zone: next.zone,
        },
        `${furniture.nameZh}已移到${positionDescription(next)}`,
      );
    },
    [applyDraftAction, setPreview],
  );

  const handleFurnitureKeyDown = useCallback(
    (
      event: ReactKeyboardEvent<HTMLButtonElement>,
      item: PlacedFurniture,
    ) => {
      if (controlsBusy) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleRemoveFurniture(item.id);
        return;
      }
      const step = event.shiftKey ? 5 : 1;
      let x = item.x;
      let y = item.y;
      if (event.key === "ArrowLeft") x -= step;
      else if (event.key === "ArrowRight") x += step;
      else if (event.key === "ArrowUp") y -= step;
      else if (event.key === "ArrowDown") y += step;
      else return;
      event.preventDefault();
      const next = clampPlacement(item.id, x, y);
      const furniture = getFurniture(item.id);
      if (!next || !furniture) return;
      applyDraftAction(
        {
          type: "move-furniture",
          furnitureId: next.id,
          x: next.x,
          y: next.y,
          zone: next.zone,
        },
        `${furniture.nameZh}已移到${positionDescription(next)}`,
      );
    },
    [applyDraftAction, controlsBusy, handleRemoveFurniture],
  );

  const handleWallpaper = useCallback(
    (wallpaperId: WallpaperId) => {
      if (controlsBusy || draftRoomRef.current.wallpaperId === wallpaperId) return;
      const wallpaper = WALLPAPERS.find((item) => item.id === wallpaperId);
      if (!wallpaper) return;
      applyDraftAction(
        { type: "select-wallpaper", wallpaperId },
        `已預覽${wallpaper.nameZh}壁紙`,
      );
    },
    [applyDraftAction, controlsBusy],
  );

  const handleFloor = useCallback(
    (floorId: FloorId) => {
      if (controlsBusy || draftRoomRef.current.floorId === floorId) return;
      const floor = FLOORS.find((item) => item.id === floorId);
      if (!floor) return;
      applyDraftAction(
        { type: "select-floor", floorId },
        `已預覽${floor.nameZh}地板`,
      );
    },
    [applyDraftAction, controlsBusy],
  );

  const handleRestore = useCallback(() => {
    if (controlsBusy) return;
    const restored = cloneRoom(originalRoomRef.current);
    draftRoomRef.current = restored;
    setDraftRoom(restored);
    setSelectedId(null);
    setPreview(null);
    setAnnouncement("已還原成開啟佈置模式時的房間");
  }, [controlsBusy, setPreview]);

  const handleSave = useCallback(async () => {
    if (controlsBusy || !dirty || saveActions.length === 0) return;
    setSubmitting(true);
    setAnnouncement("正在儲存房間佈置");
    try {
      await onSave(saveActions);
      originalRoomRef.current = cloneRoom(draftRoomRef.current);
      setAnnouncement("房間佈置已儲存");
    } catch {
      setAnnouncement("房間暫時無法儲存，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }, [controlsBusy, dirty, onSave, saveActions]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-sky-50 text-slate-800"
      data-room-editor
      aria-busy={controlsBusy}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-cottage-room-editor-title"
        tabIndex={-1}
        className="flex h-[100dvh] min-h-0 flex-col"
      >
        <header className="relative z-20 flex min-h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-xl sm:px-5">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestCancel}
            disabled={controlsBusy}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50"
            aria-label="取消佈置"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-600 sm:text-xs">
              Decorate your room
            </p>
            <h2
              id="cloud-cottage-room-editor-title"
              className="truncate text-base font-black tracking-tight sm:text-xl"
            >
              佈置雲朵小屋
            </h2>
          </div>
          <button
            type="button"
            onClick={handleRestore}
            disabled={controlsBusy || !dirty}
            className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">還原</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={controlsBusy || !dirty || saveActions.length === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:opacity-40"
          >
            {submitting ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : (
              <SaveIcon className="size-4" aria-hidden="true" />
            )}
            儲存
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(250px,56dvh)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-1">
          <main className="relative min-h-0 overflow-hidden bg-gradient-to-b from-sky-100 to-blue-50 p-2 sm:p-4 md:p-6">
            <div className="mx-auto flex h-full max-w-5xl items-center justify-center">
              <RoomWorld
                room={draftRoom}
                editor
                selectedId={selectedId}
                previewPlacement={dragPreview?.placement ?? null}
                onSelect={setSelectedId}
                onFurniturePointerDown={handlePointerDown}
                onFurniturePointerMove={handlePointerMove}
                onFurniturePointerUp={handlePointerUp}
                onFurnitureKeyDown={handleFurnitureKeyDown}
                className="max-h-full w-full shadow-xl"
              >
                <div className="pointer-events-none absolute inset-x-3 top-3 z-40 flex justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-900/65 sm:text-xs">
                  <span className="rounded-full bg-white/70 px-3 py-1 shadow-sm backdrop-blur-md">
                    Wall · 牆面
                  </span>
                  <span className="self-end rounded-full bg-white/70 px-3 py-1 shadow-sm backdrop-blur-md">
                    拖曳或用方向鍵移動
                  </span>
                </div>
              </RoomWorld>
            </div>
          </main>

          <aside className="min-h-0 overflow-y-auto border-t border-slate-200 bg-white/96 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl md:border-l md:border-t-0 md:shadow-[-8px_0_24px_rgba(15,23,42,0.06)]">
            <div
              role="tablist"
              aria-label="佈置物品分類"
              className="grid grid-cols-3 rounded-[10px] bg-slate-100 p-1"
            >
              {(
                [
                  ["furniture", "家具", Layers3],
                  ["wallpaper", "壁紙", Paintbrush],
                  ["floor", "地板", PackagePlus],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => setActiveTab(id)}
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] px-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activeTab === id
                      ? "bg-white text-sky-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "furniture" ? (
              <div role="tabpanel" className="mt-4 space-y-5">
                {selectedPlacement && selectedDefinition ? (
                  <section className="rounded-[12px] border border-sky-200 bg-sky-50 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        {FURNITURE_EMOJI[selectedDefinition.id]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-slate-800">
                          {selectedDefinition.nameZh}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {selectedDefinition.nameEn} · {positionDescription(selectedPlacement)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFurniture(selectedDefinition.id)}
                        disabled={controlsBusy || selectedDefinition.id === "cloud-bed"}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-rose-600 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:text-slate-300"
                        aria-label={
                          selectedDefinition.id === "cloud-bed"
                            ? "雲朵床不能收起"
                            : `收起${selectedDefinition.nameZh}`
                        }
                      >
                        <Trash2 className="size-5" aria-hidden="true" />
                      </button>
                    </div>
                  </section>
                ) : (
                  <p className="rounded-[10px] bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    點選場景中的家具可移動或收起。
                  </p>
                )}

                <section aria-labelledby="room-inventory-heading">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 id="room-inventory-heading" className="text-sm font-black">
                      家具庫存
                    </h3>
                    <span className="text-xs text-slate-500">
                      {ownedFurniture.length} 件
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ownedFurniture.map((item) => {
                      const isPlaced = placedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-room-add-id={item.id}
                          onClick={() => {
                            if (isPlaced) setSelectedId(item.id);
                            else handleAddFurniture(item.id);
                          }}
                          disabled={controlsBusy}
                          className={`relative flex min-h-16 items-center gap-2 rounded-[10px] border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 ${
                            selectedId === item.id
                              ? "border-sky-400 bg-sky-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/50"
                          }`}
                          aria-label={
                            isPlaced
                              ? `選取${item.nameZh}，已放置`
                              : `放置${item.nameZh}`
                          }
                        >
                          <span className="text-xl" aria-hidden="true">
                            {FURNITURE_EMOJI[item.id]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">
                              {item.nameZh}
                            </span>
                            <span className="block truncate text-[10px] text-slate-500">
                              {item.nameEn}
                            </span>
                          </span>
                          {isPlaced ? (
                            <Check className="size-4 shrink-0 text-sky-600" aria-hidden="true" />
                          ) : (
                            <PackagePlus className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {draftRoom.placed.length > 0 ? (
                  <section aria-labelledby="room-layers-heading">
                    <h3 id="room-layers-heading" className="mb-2 text-sm font-black">
                      圖層（最上層優先）
                    </h3>
                    <div className="space-y-1">
                      {[...draftRoom.placed].reverse().map((placement, reverseIndex) => {
                        const item = getFurniture(placement.id);
                        if (!item) return null;
                        return (
                          <button
                            key={placement.id}
                            type="button"
                            onClick={() => setSelectedId(placement.id)}
                            className={`flex min-h-11 w-full items-center gap-2 rounded-[8px] px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                              selectedId === placement.id
                                ? "bg-sky-100 font-bold text-sky-800"
                                : "hover:bg-slate-100"
                            }`}
                          >
                            <span aria-hidden="true">{FURNITURE_EMOJI[placement.id]}</span>
                            <span className="min-w-0 flex-1 truncate">{item.nameZh}</span>
                            <span className="text-xs tabular-nums text-slate-400">
                              {draftRoom.placed.length - reverseIndex}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {activeTab === "wallpaper" ? (
              <div role="tabpanel" className="mt-4">
                <h3 className="mb-2 text-sm font-black">已擁有的壁紙</h3>
                <div className="space-y-2">
                  {ownedWallpapers.map((item) => {
                    const selected = draftRoom.wallpaperId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-wallpaper-id={item.id}
                        aria-pressed={selected}
                        onClick={() => handleWallpaper(item.id)}
                        disabled={controlsBusy}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-[10px] border p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 ${
                          selected
                            ? "border-sky-400 bg-sky-50 shadow-sm"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`size-10 shrink-0 rounded-[8px] border border-white shadow-sm ${WALLPAPER_SWATCH[item.id]}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{item.nameZh}</span>
                          <span className="block text-xs text-slate-500">{item.nameEn}</span>
                        </span>
                        {selected ? <Check className="size-5 text-sky-600" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activeTab === "floor" ? (
              <div role="tabpanel" className="mt-4">
                <h3 className="mb-2 text-sm font-black">已擁有的地板</h3>
                <div className="space-y-2">
                  {ownedFloors.map((item) => {
                    const selected = draftRoom.floorId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-floor-id={item.id}
                        aria-pressed={selected}
                        onClick={() => handleFloor(item.id)}
                        disabled={controlsBusy}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-[10px] border p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 ${
                          selected
                            ? "border-sky-400 bg-sky-50 shadow-sm"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`size-10 shrink-0 rounded-[8px] border border-white shadow-sm ${FLOOR_SWATCH[item.id]}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{item.nameZh}</span>
                          <span className="block text-xs text-slate-500">{item.nameEn}</span>
                        </span>
                        {selected ? <Check className="size-5 text-sky-600" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {confirmCancel ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5 backdrop-blur-sm">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="discard-room-title"
              aria-describedby="discard-room-description"
              className="w-full max-w-sm rounded-[16px] border border-white/70 bg-white p-5 shadow-2xl"
            >
              <h3 id="discard-room-title" className="text-lg font-black">
                放棄這次佈置嗎？
              </h3>
              <p id="discard-room-description" className="mt-2 text-sm leading-6 text-slate-600">
                尚未儲存的家具位置、壁紙與地板變更都會消失。
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmCancel(false)}
                  className="inline-flex min-h-11 items-center rounded-[8px] border border-slate-200 px-4 text-sm font-bold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  繼續佈置
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex min-h-11 items-center rounded-[8px] bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                >
                  放棄變更
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
