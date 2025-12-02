import {
  useState,
  useCallback,
  useEffect,
  useRef,
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

export const SpeechProvider = ({ children }: SpeechProviderProps) => {
  const { ttsMode: settingsTtsMode, updateTtsMode } = useSettings();
  const [speechRate, setSpeechRate] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsMode, setTtsMode] = useState<TTSMode>(settingsTtsMode);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(
    null,
  );
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const currentAudioUrl = useRef<string | null>(null);

  // Sync local ttsMode with settings
  useEffect(() => {
    setTtsMode(settingsTtsMode);
  }, [settingsTtsMode]);

  // Update settings when ttsMode changes
  const handleSetTtsMode = useCallback(
    (mode: TTSMode) => {
      setTtsMode(mode);
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

  const stopSpeaking = useCallback(() => {
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsLoadingAudio(false);
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    // Revoke object URL but keep blob in cache
    if (currentAudioUrl.current) {
      URL.revokeObjectURL(currentAudioUrl.current);
      currentAudioUrl.current = null;
    }
  }, [speechSupported, currentAudio]);

  const speakWithAPI = useCallback(
    async (text: string) => {
      try {
        setIsLoadingAudio(true);
        setIsSpeaking(false);

        // Generate cache key
        const cacheKey = ttsCache.getCacheKey(text, speechRate);

        // Check for pending request
        const pendingRequest = ttsCache.getPendingRequest(cacheKey);
        if (pendingRequest) {
          // Wait for the existing request to complete
          const blob = await pendingRequest;
          const audioUrl = URL.createObjectURL(blob);
          currentAudioUrl.current = audioUrl;
          setIsLoadingAudio(false);

          const audio = new Audio(audioUrl);
          setCurrentAudio(audio);
          setIsSpeaking(true);

          audio.onended = () => {
            setIsSpeaking(false);
            setCurrentAudio(null);
            if (currentAudioUrl.current) {
              URL.revokeObjectURL(currentAudioUrl.current);
              currentAudioUrl.current = null;
            }
          };

          audio.onerror = () => {
            setIsSpeaking(false);
            setIsLoadingAudio(false);
            setCurrentAudio(null);
            if (currentAudioUrl.current) {
              URL.revokeObjectURL(currentAudioUrl.current);
              currentAudioUrl.current = null;
            }
            throw new Error("音訊播放失敗");
          };

          await audio.play();
          return;
        }

        // Check cache
        const cachedBlob = await ttsCache.get(cacheKey);
        if (cachedBlob) {
          // Cache hit - use cached blob
          const audioUrl = URL.createObjectURL(cachedBlob);
          currentAudioUrl.current = audioUrl;
          setIsLoadingAudio(false);

          const audio = new Audio(audioUrl);
          setCurrentAudio(audio);
          setIsSpeaking(true);

          audio.onended = () => {
            setIsSpeaking(false);
            setCurrentAudio(null);
            if (currentAudioUrl.current) {
              URL.revokeObjectURL(currentAudioUrl.current);
              currentAudioUrl.current = null;
            }
          };

          audio.onerror = () => {
            setIsSpeaking(false);
            setIsLoadingAudio(false);
            setCurrentAudio(null);
            if (currentAudioUrl.current) {
              URL.revokeObjectURL(currentAudioUrl.current);
              currentAudioUrl.current = null;
            }
            throw new Error("音訊播放失敗");
          };

          await audio.play();
          return;
        }

        // Cache miss - fetch from API
        const fetchPromise = (async () => {
          const response = await apiFetch(TTS_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            includeAuthToken: true,
            body: JSON.stringify({
              text: text,
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

        // Save to cache
        await ttsCache.set(cacheKey, blob);

        const audioUrl = URL.createObjectURL(blob);
        currentAudioUrl.current = audioUrl;

        setIsLoadingAudio(false);

        const audio = new Audio(audioUrl);
        setCurrentAudio(audio);
        setIsSpeaking(true);

        audio.onended = () => {
          setIsSpeaking(false);
          setCurrentAudio(null);
          if (currentAudioUrl.current) {
            URL.revokeObjectURL(currentAudioUrl.current);
            currentAudioUrl.current = null;
          }
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          setIsLoadingAudio(false);
          setCurrentAudio(null);
          if (currentAudioUrl.current) {
            URL.revokeObjectURL(currentAudioUrl.current);
            currentAudioUrl.current = null;
          }
          throw new Error("音訊播放失敗");
        };

        await audio.play();
      } catch (err: unknown) {
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        const message = err instanceof Error ? err.message : "TTS API 呼叫失敗";
        throw new Error(message);
      }
    },
    [speechRate],
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

              const cacheKey = ttsCache.getCacheKey(text, speechRate);

              let blob: Blob;

              const pendingRequest = ttsCache.getPendingRequest(cacheKey);
              if (pendingRequest) {
                blob = await pendingRequest;
              } else {
                const cachedBlob = await ttsCache.get(cacheKey);
                if (cachedBlob) {
                  blob = cachedBlob;
                } else {
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

                  ttsCache.setPendingRequest(cacheKey, fetchPromise);
                  blob = await fetchPromise;
                  await ttsCache.set(cacheKey, blob);
                }
              }

              const audioUrl = URL.createObjectURL(blob);
              currentAudioUrl.current = audioUrl;
              setIsLoadingAudio(false);

              const audio = new Audio(audioUrl);
              setCurrentAudio(audio);
              setIsSpeaking(true);

              audio.onended = () => {
                clearTimeout(timeoutId);
                setIsSpeaking(false);
                setCurrentAudio(null);
                if (currentAudioUrl.current) {
                  URL.revokeObjectURL(currentAudioUrl.current);
                  currentAudioUrl.current = null;
                }
                resolve();
              };

              audio.onerror = () => {
                clearTimeout(timeoutId);
                setIsSpeaking(false);
                setIsLoadingAudio(false);
                setCurrentAudio(null);
                if (currentAudioUrl.current) {
                  URL.revokeObjectURL(currentAudioUrl.current);
                  currentAudioUrl.current = null;
                }
                reject(new Error("音訊播放失敗"));
              };

              await audio.play();
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
    [pickEnglishVoice, speechRate, speechSupported, ttsMode, stopSpeaking],
  );

  const value: SpeechContextType = {
    speechRate,
    setSpeechRate,
    isSpeaking,
    ttsMode,
    setTtsMode: handleSetTtsMode,
    isLoadingAudio,
    speechSupported,
    speak,
    speakAsync,
    stopSpeaking,
  };

  return (
    <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>
  );
};
