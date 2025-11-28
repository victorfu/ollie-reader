import { useState, useCallback, useRef, useEffect } from "react";
import type { ReadingMode } from "../types/pdf";
import { TRANSLATE_API_URL } from "../constants/api";
import { useSettings } from "./useSettings";
import { geminiModel } from "../utils/firebaseUtil";

export type SelectionToolbarPosition = {
  top: number;
  left: number;
  placement: "above" | "below";
};

export const useTextSelection = () => {
  const { translationApi } = useSettings();
  const [readingMode, setReadingMode] = useState<ReadingMode>("selection");
  const [selectedText, setSelectedText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [toolbarPosition, setToolbarPosition] =
    useState<SelectionToolbarPosition | null>(null);
  const selectedTextRef = useRef<string>("");

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

    setIsTranslating(true);
    setTranslateError(null);

    try {
      let translatedResult: string;

      if (translationApi === "FIREBASE_AI") {
        // Use Firebase AI (Gemini) for kid-friendly translations
        const prompt = `你是一個幫助國小學生學習英文的翻譯助手。請將以下英文翻譯成繁體中文，使用簡單易懂、適合小朋友理解的詞彙和句子。翻譯要準確但用字要簡單，避免使用艱深的詞彙。

英文原文：${selectedText}

請只回覆翻譯後的中文，不要加任何其他說明。`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        translatedResult = response.text().trim();
      } else {
        // Use standard translation API
        const payload = {
          text: selectedText,
          from_lang: "en",
          to_lang: "zh-TW",
          from_code: "en",
          to_code: "zt",
        };
        const response = await fetch(TRANSLATE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`翻譯失敗: ${response.status}`);
        }

        const result = await response.json();
        translatedResult = result.text || "無翻譯結果";
      }

      setTranslatedText(translatedResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "翻譯時發生未知錯誤";
      setTranslateError(message);
    } finally {
      setIsTranslating(false);
    }
  }, [selectedText, translationApi]);

  const clearSelection = useCallback(() => {
    selectedTextRef.current = "";
    setSelectedText("");
    setTranslatedText("");
    setTranslateError(null);
    setToolbarPosition(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    if (!selectedText) return;

    const handleReposition = () => updateToolbarPosition();

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
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
