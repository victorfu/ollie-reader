import { useState, useCallback, useRef, useEffect } from "react";
import type { SelectionRect } from "../utils/pdfWordSelection";

export type SelectionToolbarPosition = {
  top: number;
  left: number;
  placement: "above" | "below";
};

export type TextSelectionPayload = {
  text: string;
  getAnchorRect: () => SelectionRect | null;
  onClear: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "input, textarea, [contenteditable]:not([contenteditable='false'])",
      ),
    )
  );
}

export function useTextSelection() {
  const [selectedText, setSelectedText] = useState<string>("");
  const [toolbarPosition, setToolbarPosition] =
    useState<SelectionToolbarPosition | null>(null);
  const selectedTextRef = useRef("");
  const customSelectionRef = useRef<TextSelectionPayload | null>(null);

  const updateToolbarPosition = useCallback(() => {
    const customSelection = customSelectionRef.current;
    const selection = customSelection ? null : window.getSelection();
    const rect = customSelection
      ? customSelection.getAnchorRect()
      : selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).getBoundingClientRect()
        : null;
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setToolbarPosition(null);
      return;
    }

    const margin = 16;
    const horizontalBuffer = 180;
    const rawLeft = rect.left + rect.width / 2;
    const viewportWidth = window.innerWidth;
    const placement: SelectionToolbarPosition["placement"] =
      rect.top < 140 ? "below" : "above";
    const top =
      placement === "above" ? rect.top - margin : rect.bottom + margin;

    if (viewportWidth <= horizontalBuffer * 2) {
      setToolbarPosition({ top, left: viewportWidth / 2, placement });
      return;
    }

    const clampedLeft = Math.min(
      Math.max(rawLeft, horizontalBuffer),
      viewportWidth - horizontalBuffer,
    );

    setToolbarPosition({ top, left: clampedLeft, placement });
  }, []);

  const handleTextSelection = useCallback(
    (payload?: TextSelectionPayload) => {
      const previousCustomSelection = customSelectionRef.current;
      if (payload?.text.trim()) {
        if (
          previousCustomSelection &&
          previousCustomSelection.onClear !== payload.onClear
        ) {
          previousCustomSelection.onClear();
        }
        customSelectionRef.current = payload;
        window.getSelection()?.removeAllRanges();
      } else {
        customSelectionRef.current = null;
        previousCustomSelection?.onClear();
      }

      const text =
        payload?.text.trim() || window.getSelection()?.toString().trim() || "";
      if (text !== selectedTextRef.current) {
        selectedTextRef.current = text;
        setSelectedText(text);
      }
      if (text) {
        updateToolbarPosition();
      } else {
        setToolbarPosition(null);
      }
    },
    [updateToolbarPosition],
  );

  const clearSelection = useCallback(() => {
    const customSelection = customSelectionRef.current;
    customSelectionRef.current = null;
    customSelection?.onClear();
    selectedTextRef.current = "";
    setSelectedText("");
    setToolbarPosition(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (
        !customSelectionRef.current ||
        !selectedTextRef.current ||
        event.defaultPrevented ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      const nativeSelection = window.getSelection();
      if (
        nativeSelection &&
        !nativeSelection.isCollapsed &&
        nativeSelection.toString()
      ) {
        return;
      }
      if (!event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", selectedTextRef.current);
    };

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, []);

  useEffect(() => {
    if (!selectedText) return;

    let rafId: number | null = null;
    const handleReposition = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateToolbarPosition);
    };

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [selectedText, updateToolbarPosition]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedText) {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedText, clearSelection]);

  return {
    selectedText,
    handleTextSelection,
    clearSelection,
    toolbarPosition,
  };
}
