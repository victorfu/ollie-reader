import { useState, useEffect, useCallback, useRef } from "react";
import { cleanText } from "../utils/textUtils";

interface UsePronunciationResult {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
}

export const usePronunciation = (
  targetWord: string,
  onMatch?: () => void,
): UsePronunciationResult => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      setIsSupported(true);
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";
    }

    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore errors during cleanup
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const checkMatch = useCallback(
    (spokenText: string) => {
      const cleanedSpoken = cleanText(spokenText);
      const cleanedTarget = cleanText(targetWord);

      // Exact match or contains the word
      if (
        cleanedSpoken === cleanedTarget ||
        cleanedSpoken.includes(cleanedTarget)
      ) {
        if (onMatch) onMatch();
        return true;
      }
      return false;
    },
    [targetWord, onMatch],
  );

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      setError(null);
      setTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error("Speech recognition start error:", err);
      // Usually happens if already started, safe to ignore or reset
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (err) {
      console.error("Speech recognition stop error:", err);
    }
  }, []);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const current = event.resultIndex;
      const transcriptResult = event.results[current][0].transcript;
      setTranscript(transcriptResult);

      if (event.results[current].isFinal) {
        checkMatch(transcriptResult);
        setIsListening(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error", event.error);
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, [checkMatch]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    error,
  };
};
