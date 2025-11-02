import { useState, useCallback, useRef, useEffect } from "react";
import type { ReadingMode } from "../types/pdf";
import { ARGOS_TRANSLATE_API_URL, TRANSLATE_API_URL } from "../constants/api";
import { useSettings } from "./useSettings";

export const useTextSelection = () => {
  const { translationApi } = useSettings();
  const [readingMode, setReadingMode] = useState<ReadingMode>("selection");
  const [selectedText, setSelectedText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const selectedTextRef = useRef<string>("");

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";
    if (text !== selectedTextRef.current) {
      selectedTextRef.current = text;
      setSelectedText(text);
      setTranslatedText("");
      setTranslateError(null);
    }
  }, []);

  const translateText = useCallback(async () => {
    if (!selectedText.trim()) return;

    setIsTranslating(true);
    setTranslateError(null);

    try {
      // Get the API URL based on user settings
      const apiUrl =
        translationApi === "ARGOS_TRANSLATE_API_URL"
          ? ARGOS_TRANSLATE_API_URL
          : TRANSLATE_API_URL;

      const payload = {
        text: selectedText,
        from_lang: "en",
        to_lang: "zh-TW",
        from_code: "en",
        to_code: "zt",
      };
      const response = await fetch(apiUrl, {
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
      setTranslatedText(result.text || "無翻譯結果");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "翻譯時發生未知錯誤";
      setTranslateError(message);
    } finally {
      setIsTranslating(false);
    }
  }, [selectedText, translationApi]);

  const clearSelection = useCallback(() => {
    setSelectedText("");
    setTranslatedText("");
    setTranslateError(null);
    window.getSelection()?.removeAllRanges();
  }, []);

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
  };
};
