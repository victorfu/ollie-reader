import { useState, useCallback, useEffect, useRef } from "react";
import type React from "react";

type PanelPoint = { x: number; y: number };
type PanelSize = { width: number; height: number };

interface FloatingPanelGeometry {
  position: PanelPoint;
  size: PanelSize;
}

interface FitFloatingPanelOptions extends FloatingPanelGeometry {
  minSize: PanelSize;
  maxSize: PanelSize;
  viewport: PanelSize;
  margin?: number;
}

interface FloatingPanelOptions {
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
}

interface FloatingPanelResult {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isDragging: boolean;
  isResizing: boolean;
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
  resizeHandleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
  panelStyle: React.CSSProperties;
  resetPosition: () => void;
}

const DEFAULT_SIZE = { width: 320, height: 384 };
const DEFAULT_MIN_SIZE = { width: 240, height: 200 };
const DEFAULT_MAX_SIZE = { width: 600, height: 600 };
const MIN_VISIBLE = 50;
const VIEWPORT_MARGIN = 12;

/** Keep the whole panel reachable after a viewport resize or rotation. */
export function fitFloatingPanelToViewport({
  position,
  size,
  minSize,
  maxSize,
  viewport,
  margin = VIEWPORT_MARGIN,
}: FitFloatingPanelOptions): FloatingPanelGeometry {
  const horizontalMargin = Math.min(
    margin,
    Math.max(0, (viewport.width - 1) / 2),
  );
  const verticalMargin = Math.min(
    margin,
    Math.max(0, (viewport.height - 1) / 2),
  );
  const availableWidth = Math.max(
    1,
    viewport.width - horizontalMargin * 2,
  );
  const availableHeight = Math.max(
    1,
    viewport.height - verticalMargin * 2,
  );
  const effectiveMinWidth = Math.min(minSize.width, availableWidth);
  const effectiveMinHeight = Math.min(minSize.height, availableHeight);
  const width = Math.min(
    Math.max(size.width, effectiveMinWidth),
    maxSize.width,
    availableWidth,
  );
  const height = Math.min(
    Math.max(size.height, effectiveMinHeight),
    maxSize.height,
    availableHeight,
  );
  const maxX = Math.max(horizontalMargin, viewport.width - horizontalMargin - width);
  const maxY = Math.max(verticalMargin, viewport.height - verticalMargin - height);

  return {
    position: {
      x: Math.min(Math.max(position.x, horizontalMargin), maxX),
      y: Math.min(Math.max(position.y, verticalMargin), maxY),
    },
    size: { width, height },
  };
}

function computeDefaultPosition(size: { width: number; height: number }): { x: number; y: number } {
  return {
    x: window.innerWidth - size.width - 80,
    y: window.innerHeight - size.height - 24,
  };
}

function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, MIN_VISIBLE - width), window.innerWidth - MIN_VISIBLE),
    y: Math.min(Math.max(y, MIN_VISIBLE - height), window.innerHeight - MIN_VISIBLE),
  };
}

export const useFloatingPanel = (options: FloatingPanelOptions = {}): FloatingPanelResult => {
  const {
    defaultPosition,
    defaultSize = DEFAULT_SIZE,
    minSize = DEFAULT_MIN_SIZE,
    maxSize = DEFAULT_MAX_SIZE,
  } = options;
  const minWidth = minSize.width;
  const minHeight = minSize.height;
  const maxWidth = maxSize.width;
  const maxHeight = maxSize.height;

  const [geometry, setGeometry] = useState<FloatingPanelGeometry>(() =>
    fitFloatingPanelToViewport({
      position: defaultPosition ?? computeDefaultPosition(defaultSize),
      size: defaultSize,
      minSize,
      maxSize,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    }),
  );
  const { position, size } = geometry;
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ pointerX: 0, pointerY: 0, width: 0, height: 0 });
  const activePointerIdRef = useRef<number | null>(null);
  const gestureCleanupRef = useRef<((updateState?: boolean) => void) | null>(
    null,
  );

  useEffect(
    () => () => {
      gestureCleanupRef.current?.(false);
    },
    [],
  );

  const clampToCurrentViewport = useCallback(() => {
    setGeometry((current) => {
      const next = fitFloatingPanelToViewport({
        ...current,
        minSize: { width: minWidth, height: minHeight },
        maxSize: { width: maxWidth, height: maxHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
      if (
        next.position.x === current.position.x &&
        next.position.y === current.position.y &&
        next.size.width === current.size.width &&
        next.size.height === current.size.height
      ) {
        return current;
      }
      return next;
    });
  }, [minWidth, minHeight, maxWidth, maxHeight]);

  useEffect(() => {
    window.addEventListener("resize", clampToCurrentViewport);
    window.addEventListener("orientationchange", clampToCurrentViewport);
    return () => {
      window.removeEventListener("resize", clampToCurrentViewport);
      window.removeEventListener("orientationchange", clampToCurrentViewport);
    };
  }, [clampToCurrentViewport]);

  // Drag handlers
  const handleDragPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (activePointerIdRef.current !== null) return;

    const pointerId = e.pointerId;
    const captureTarget = e.currentTarget as HTMLElement;
    captureTarget.setPointerCapture(pointerId);
    activePointerIdRef.current = pointerId;

    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    setIsDragging(true);

    const handlePointerMove = (ev: PointerEvent) => {
      if (
        ev.pointerId !== pointerId ||
        activePointerIdRef.current !== pointerId
      ) {
        return;
      }
      const newX = ev.clientX - dragOffsetRef.current.x;
      const newY = ev.clientY - dragOffsetRef.current.y;
      setGeometry((current) => {
        const clamped = clampPosition(
          newX,
          newY,
          current.size.width,
          current.size.height,
        );
        if (
          clamped.x === current.position.x &&
          clamped.y === current.position.y
        ) {
          return current;
        }
        return { ...current, position: clamped };
      });
    };

    const cleanup = (updateState = true) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      captureTarget.removeEventListener("lostpointercapture", handlePointerEnd);
      if (activePointerIdRef.current === pointerId) {
        activePointerIdRef.current = null;
      }
      if (gestureCleanupRef.current === cleanup) {
        gestureCleanupRef.current = null;
      }
      if (updateState) setIsDragging(false);
    };

    const handlePointerEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    };

    gestureCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    captureTarget.addEventListener("lostpointercapture", handlePointerEnd);
  }, [position.x, position.y]);

  // Resize handlers
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activePointerIdRef.current !== null) return;

    const pointerId = e.pointerId;
    const captureTarget = e.currentTarget as HTMLElement;
    captureTarget.setPointerCapture(pointerId);
    activePointerIdRef.current = pointerId;

    resizeStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      width: size.width,
      height: size.height,
    };
    setIsResizing(true);

    const handlePointerMove = (ev: PointerEvent) => {
      if (
        ev.pointerId !== pointerId ||
        activePointerIdRef.current !== pointerId
      ) {
        return;
      }
      const deltaX = ev.clientX - resizeStartRef.current.pointerX;
      const deltaY = ev.clientY - resizeStartRef.current.pointerY;

      const newWidth = Math.min(
        Math.max(resizeStartRef.current.width + deltaX, minSize.width),
        maxSize.width,
      );
      const newHeight = Math.min(
        Math.max(resizeStartRef.current.height + deltaY, minSize.height),
        maxSize.height,
      );

      // Clamp so panel doesn't extend beyond viewport
      const maxWidth = window.innerWidth - position.x;
      const maxHeight = window.innerHeight - position.y;
      const clampedWidth = Math.min(newWidth, Math.max(maxWidth, minSize.width));
      const clampedHeight = Math.min(newHeight, Math.max(maxHeight, minSize.height));

      setGeometry((current) => {
        if (
          current.size.width === clampedWidth &&
          current.size.height === clampedHeight
        ) {
          return current;
        }
        const next = { width: clampedWidth, height: clampedHeight };
        return { ...current, size: next };
      });
    };

    const cleanup = (updateState = true) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      captureTarget.removeEventListener("lostpointercapture", handlePointerEnd);
      if (activePointerIdRef.current === pointerId) {
        activePointerIdRef.current = null;
      }
      if (gestureCleanupRef.current === cleanup) {
        gestureCleanupRef.current = null;
      }
      if (updateState) setIsResizing(false);
    };

    const handlePointerEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    };

    gestureCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    captureTarget.addEventListener("lostpointercapture", handlePointerEnd);
  }, [size.width, size.height, minSize.width, minSize.height, maxSize.width, maxSize.height, position.x, position.y]);

  // Reset position to default bottom-right
  const resetPosition = useCallback(() => {
    const defaultPos = defaultPosition ?? computeDefaultPosition(defaultSize);
    const next = fitFloatingPanelToViewport({
      position: defaultPos,
      size: defaultSize,
      minSize,
      maxSize,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    setGeometry(next);
  }, [
    defaultPosition,
    defaultSize,
    minSize,
    maxSize,
  ]);

  const panelStyle: React.CSSProperties = {
    position: "fixed" as const,
    top: position.y,
    left: position.x,
    width: size.width,
    height: size.height,
    zIndex: 40,
  };

  const dragHandleProps = {
    onPointerDown: handleDragPointerDown,
    style: { cursor: "grab", userSelect: "none" as const, touchAction: "none" as const },
  };

  const resizeHandleProps = {
    onPointerDown: handleResizePointerDown,
    style: { cursor: "nwse-resize", userSelect: "none" as const, touchAction: "none" as const },
  };

  return {
    position,
    size,
    isDragging,
    isResizing,
    dragHandleProps,
    resizeHandleProps,
    panelStyle,
    resetPosition,
  };
};
