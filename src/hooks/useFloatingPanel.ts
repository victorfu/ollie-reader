import { useState, useCallback, useRef } from "react";
import type React from "react";

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

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (defaultPosition) return defaultPosition;
    return computeDefaultPosition(defaultSize);
  });

  const [size, setSize] = useState<{ width: number; height: number }>(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ pointerX: 0, pointerY: 0, width: 0, height: 0 });

  // Drag handlers
  const handleDragPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    setIsDragging(true);

    const handlePointerMove = (ev: PointerEvent) => {
      const newX = ev.clientX - dragOffsetRef.current.x;
      const newY = ev.clientY - dragOffsetRef.current.y;
      setPosition((prev) => {
        const clamped = clampPosition(newX, newY, size.width, size.height);
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        return clamped;
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [position.x, position.y, size.width, size.height]);

  // Resize handlers
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    resizeStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      width: size.width,
      height: size.height,
    };
    setIsResizing(true);

    const handlePointerMove = (ev: PointerEvent) => {
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

      setSize((prev) => {
        if (prev.width === clampedWidth && prev.height === clampedHeight) return prev;
        return { width: clampedWidth, height: clampedHeight };
      });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [size.width, size.height, minSize.width, minSize.height, maxSize.width, maxSize.height, position.x, position.y]);

  // Reset position to default bottom-right
  const resetPosition = useCallback(() => {
    const defaultPos = defaultPosition ?? computeDefaultPosition(defaultSize);
    setPosition(defaultPos);
    setSize(defaultSize);
  }, [defaultPosition, defaultSize]);

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
