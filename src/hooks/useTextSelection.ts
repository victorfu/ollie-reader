import { useState, useCallback, useRef, useEffect } from "react";
import type { ReadingMode } from "../types/pdf";
import { translateWithAI } from "../services/aiService";
import {
  findExistingTranslation,
  addSentenceTranslation,
} from "../services/sentenceTranslationService";
import { useAuth } from "./useAuth";
import { isAbortError } from "../utils/errorUtils";
import { logger } from "../utils/logger";

export type SelectionToolbarPosition = {
  top: number;
  left: number;
  placement: "above" | "below";
};

export const useTextSelection = (sourcePdfName?: string) => {
  const { user } = useAuth();
  const [readingMode, setReadingMode] = useState<ReadingMode>("selection");
  const [selectedText, setSelectedText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [toolbarPosition, setToolbarPosition] =
    useState<SelectionToolbarPosition | null>(null);
  const selectedTextRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const updateToolbarPosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setToolbarPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
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

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";
    if (text !== selectedTextRef.current) {
      selectedTextRef.current = text;
      setSelectedText(text);
      setTranslatedText("");
      setTranslateError(null);
    }
    if (text) {
      updateToolbarPosition();
    } else {
      setToolbarPosition(null);
    }
  }, [updateToolbarPosition]);

  const translateText = useCallback(async () => {
    if (!selectedText.trim()) return;

    // Abort any previous translation request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsTranslating(true);
    setTranslateError(null);

    const trimmedText = selectedText.trim();

    try {
      // Check if aborted before making API call
      if (controller.signal.aborted) return;

      // Check Firestore cache first (if user is logged in)
      if (user) {
        const cached = await findExistingTranslation(user.uid, trimmedText);
        if (cached) {
          // 確認選取的文字仍然相同
          if (selectedTextRef.current === trimmedText) {
            logger.info("Translation cache hit");
            setTranslatedText(cached.chinese);
          }
          setIsTranslating(false);
          return;
        }
      }

      if (controller.signal.aborted) return;

      // Use AI service for kid-friendly translations
      const result = await translateWithAI(trimmedText, controller.signal);

      // Check if aborted after API call or text changed
      if (controller.signal.aborted || selectedTextRef.current !== trimmedText) {
        return;
      }

      if (!result) {
        throw new Error("翻譯失敗");
      }

      // Save to Firestore cache (if user is logged in)
      if (user) {
        try {
          await addSentenceTranslation({
            userId: user.uid,
            english: trimmedText,
            chinese: result,
            sourcePdfName,
          });
          logger.info("Translation saved to cache");
        } catch (saveErr) {
          // Don't fail the translation if saving to cache fails
          logger.error("Failed to save translation to cache:", saveErr);
        }
      }

      setTranslatedText(result);
    } catch (err: unknown) {
      // Ignore abort errors
      if (isAbortError(err)) return;

      const message = err instanceof Error ? err.message : "翻譯時發生未知錯誤";
      setTranslateError(message);
    } finally {
      // 無條件重置 loading 狀態，避免 abort 時卡住
      setIsTranslating(false);
    }
  }, [selectedText, user, sourcePdfName]);

  const clearSelection = useCallback(() => {
    abortControllerRef.current?.abort();
    selectedTextRef.current = "";
    setSelectedText("");
    setTranslatedText("");
    setTranslateError(null);
    setToolbarPosition(null);
    window.getSelection()?.removeAllRanges();
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
    readingMode,
    setReadingMode,
    selectedText,
    translatedText,
    isTranslating,
    translateError,
    handleTextSelection,
    translateText,
    clearSelection,
    setTranslatedText,
    toolbarPosition,
  };
};
