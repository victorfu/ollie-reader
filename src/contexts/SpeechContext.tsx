import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import type { TTSMode } from "../types/pdf";
import { SpeechContext, type SpeechContextType } from "./SpeechContextType";
import { TTS_API_URL } from "../constants/api";
import { useSettings } from "../hooks/useSettings";
import { ttsCache } from "../services/ttsCache";
import { apiFetch } from "../utils/apiUtil";

interface SpeechProviderProps {
  children: ReactNode;
}

/**
 * Fetch TTS audio blob from API or cache
 */
async function fetchTTSBlob(text: string, speechRate: number): Promise<Blob> {
  const cacheKey = ttsCache.getCacheKey(text, speechRate);

  // Check for pending request
  const pendingRequest = ttsCache.getPendingRequest(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  // Check cache
  const cachedBlob = await ttsCache.get(cacheKey);
  if (cachedBlob) {
    return cachedBlob;
  }

  // Cache miss - fetch from API
  const fetchPromise = (async () => {
    const response = await apiFetch(TTS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      includeAuthToken: true,
      body: JSON.stringify({
        text,
        language_code: "en-US",
        speaking_rate: speechRate,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API 錯誤: ${response.status}`);
    }

    return await response.blob();
  })();

  // Register pending request
  ttsCache.setPendingRequest(cacheKey, fetchPromise);

  const blob = await fetchPromise;
  await ttsCache.set(cacheKey, blob);

  return blob;
}

export const SpeechProvider = ({ children }: SpeechProviderProps) => {
  const {
    ttsMode,
    speechRate,
    updateTtsMode,
  } = useSettings();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const currentAudioUrl = useRef<string | null>(null);

  // Update settings when ttsMode changes
  const handleSetTtsMode = useCallback(
    (mode: TTSMode) => {
      updateTtsMode(mode).catch((err) => {
        console.error("Failed to save TTS mode:", err);
      });
    },
    [updateTtsMode],
  );

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!speechSupported) return;
    const handle = () => {
      void window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.onvoiceschanged = handle;
    handle();
    return () => {
      if (window.speechSynthesis.onvoiceschanged === handle) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [speechSupported]);

  const pickEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!speechSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
    return en ?? null;
  }, [speechSupported]);

  // Cleanup audio URL helper
  const cleanupAudioUrl = useCallback(() => {
    if (currentAudioUrl.current) {
      URL.revokeObjectURL(currentAudioUrl.current);
      currentAudioUrl.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsLoadingAudio(false);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    cleanupAudioUrl();
  }, [speechSupported, cleanupAudioUrl]);

  /**
   * Play audio blob and return a promise that resolves when playback ends
   * @param blob - The audio blob to play
   * @param onEnd - Optional callback when audio ends (for async mode)
   * @param onError - Optional callback when audio errors (for async mode)
   */
  const playAudioBlob = useCallback(
    async (
      blob: Blob,
      onEnd?: () => void,
      onError?: (err: Error) => void,
    ): Promise<void> => {
      const audioUrl = URL.createObjectURL(blob);
      currentAudioUrl.current = audioUrl;
      setIsLoadingAudio(false);

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      setIsSpeaking(true);

      audio.onended = () => {
        setIsSpeaking(false);
        currentAudioRef.current = null;
        cleanupAudioUrl();
        onEnd?.();
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        currentAudioRef.current = null;
        cleanupAudioUrl();
        const error = new Error("音訊播放失敗");
        if (onError) {
          onError(error);
        } else {
          throw error;
        }
      };

      await audio.play();
    },
    [cleanupAudioUrl],
  );

  const speakWithAPI = useCallback(
    async (text: string) => {
      try {
        setIsLoadingAudio(true);
        setIsSpeaking(false);

        const blob = await fetchTTSBlob(text, speechRate);
        await playAudioBlob(blob);
      } catch (err: unknown) {
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        const message = err instanceof Error ? err.message : "TTS API 呼叫失敗";
        throw new Error(message);
      }
    },
    [speechRate, playAudioBlob],
  );

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      stopSpeaking();

      if (ttsMode === "api") {
        speakWithAPI(text).catch((err) => {
          console.error("TTS API error:", err);
        });
      } else {
        if (!speechSupported) return;
        const voice = pickEnglishVoice();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voice?.lang || "en-US";
        utterance.voice = voice || null;
        utterance.rate = speechRate;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }
    },
    [
      pickEnglishVoice,
      speechRate,
      speechSupported,
      ttsMode,
      stopSpeaking,
      speakWithAPI,
    ],
  );

  // Async version of speak that returns a Promise resolving when speech ends
  const speakAsync = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;

      stopSpeaking();

      const TIMEOUT_MS = 30000; // 30 second fallback timeout

      if (ttsMode === "api") {
        // For API mode, we need to wait for the audio to finish
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve();
          }, TIMEOUT_MS);

          (async () => {
            try {
              setIsLoadingAudio(true);
              setIsSpeaking(false);

              const blob = await fetchTTSBlob(text, speechRate);

              await playAudioBlob(
                blob,
                () => {
                  clearTimeout(timeoutId);
                  resolve();
                },
                (err) => {
                  clearTimeout(timeoutId);
                  reject(err);
                },
              );
            } catch (err) {
              clearTimeout(timeoutId);
              setIsSpeaking(false);
              setIsLoadingAudio(false);
              reject(err);
            }
          })();
        });
      } else {
        // Browser speech synthesis mode
        if (!speechSupported) return;

        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve();
          }, TIMEOUT_MS);

          const voice = pickEnglishVoice();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = voice?.lang || "en-US";
          utterance.voice = voice || null;
          utterance.rate = speechRate;

          utterance.onend = () => {
            clearTimeout(timeoutId);
            setIsSpeaking(false);
            resolve();
          };

          utterance.onerror = () => {
            clearTimeout(timeoutId);
            setIsSpeaking(false);
            resolve(); // Resolve instead of reject to continue playback
          };

          setIsSpeaking(true);
          window.speechSynthesis.speak(utterance);
        });
      }
    },
    [pickEnglishVoice, speechRate, speechSupported, ttsMode, stopSpeaking, playAudioBlob],
  );

  const value: SpeechContextType = useMemo(
    () => ({
      speechRate,
      isSpeaking,
      ttsMode,
      setTtsMode: handleSetTtsMode,
      isLoadingAudio,
      speechSupported,
      speak,
      speakAsync,
      stopSpeaking,
    }),
    [
      speechRate,
      isSpeaking,
      ttsMode,
      handleSetTtsMode,
      isLoadingAudio,
      speechSupported,
      speak,
      speakAsync,
      stopSpeaking,
    ]
  );

  return (
    <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>
  );
};
