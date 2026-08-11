import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import type { TTSMode, TTSEngine } from "../types/pdf";
import { SpeechContext, type SpeechContextType } from "./SpeechContextType";
import { TTS_ENGINE_PATH } from "../constants/api";
import { useSettings } from "../hooks/useSettings";
import { fetchWithComputeBase } from "../services/localBackend";
import { ttsCache } from "../services/ttsCache";
import { apiFetch } from "../utils/apiUtil";
import { isAbortError } from "../utils/errorUtils";

interface SpeechProviderProps {
  children: ReactNode;
}

const SPEECH_TIMEOUT_MS = 30_000;

interface PendingAsyncSpeech {
  generation: number;
  timeoutId: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * Fetch TTS audio blob from API or cache
 */
async function fetchTTSBlob(
  text: string,
  speechRate: number,
  engine: TTSEngine,
  signal?: AbortSignal,
): Promise<Blob> {
  const cacheKey = ttsCache.getCacheKey(text, speechRate, engine);

  const pendingRequest = ttsCache.getPendingRequest(cacheKey);
  if (pendingRequest) {
    try {
      const blob = await pendingRequest;
      signal?.throwIfAborted();
      return blob;
    } catch (error) {
      // A same-key request may belong to the operation that was just stopped.
      // The latest caller must retry instead of inheriting that AbortError.
      if (signal?.aborted || !isAbortError(error)) throw error;
    }
  }

  const cachedBlob = await ttsCache.get(cacheKey);
  signal?.throwIfAborted();
  if (cachedBlob) {
    return cachedBlob;
  }

  const fetchPromise = (async () => {
    const response = await fetchWithComputeBase(
      TTS_ENGINE_PATH[engine],
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ text, speed: speechRate }),
      },
      apiFetch,
    );

    // 不做引擎降級：選定的引擎若不可用（後端回 503）或其他錯誤，直接把錯誤丟出，
    // 讓使用者知道所選引擎沒生效，而不是安靜地換成別的引擎。
    if (!response.ok) {
      throw new Error(`TTS API 錯誤: ${response.status}`);
    }

    const blob = await response.blob();
    await ttsCache.set(cacheKey, blob);
    signal?.throwIfAborted();
    return blob;
  })();

  ttsCache.setPendingRequest(cacheKey, fetchPromise);

  return fetchPromise;
}

export const SpeechProvider = ({ children }: SpeechProviderProps) => {
  const {
    ttsMode,
    ttsEngine,
    speechRate,
    updateTtsMode,
  } = useSettings();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const currentAudioUrl = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const speechGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const pendingAsyncRef = useRef<PendingAsyncSpeech | null>(null);

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

  const isCurrentOperation = useCallback(
    (generation: number) =>
      mountedRef.current && speechGenerationRef.current === generation,
    [],
  );

  const cleanupAudioUrl = useCallback(() => {
    if (currentAudioUrl.current) {
      URL.revokeObjectURL(currentAudioUrl.current);
      currentAudioUrl.current = null;
    }
  }, []);

  const settleAsyncSpeech = useCallback(
    (generation: number, error?: Error) => {
      const pending = pendingAsyncRef.current;
      if (!pending || pending.generation !== generation) return;
      window.clearTimeout(pending.timeoutId);
      pendingAsyncRef.current = null;
      if (error) pending.reject(error);
      else pending.resolve();
    },
    [],
  );

  const stopSpeaking = useCallback(() => {
    speechGenerationRef.current += 1;
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    const audio = currentAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
      currentAudioRef.current = null;
    }
    cleanupAudioUrl();
    const pending = pendingAsyncRef.current;
    if (pending) {
      window.clearTimeout(pending.timeoutId);
      pendingAsyncRef.current = null;
      pending.resolve();
    }
    if (mountedRef.current) {
      setIsSpeaking(false);
      setIsLoadingAudio(false);
    }
  }, [speechSupported, cleanupAudioUrl]);

  const playAudioBlob = useCallback(
    async (
      blob: Blob,
      generation: number,
      onEnd?: () => void,
      onError?: (err: Error) => void,
    ): Promise<void> => {
      if (!isCurrentOperation(generation)) return;

      const audioUrl = URL.createObjectURL(blob);
      currentAudioUrl.current = audioUrl;
      setIsLoadingAudio(false);

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      setIsSpeaking(true);

      audio.onended = () => {
        if (
          !isCurrentOperation(generation)
          || currentAudioRef.current !== audio
        ) return;
        setIsSpeaking(false);
        currentAudioRef.current = null;
        if (currentAudioUrl.current === audioUrl) cleanupAudioUrl();
        onEnd?.();
      };

      audio.onerror = () => {
        if (
          !isCurrentOperation(generation)
          || currentAudioRef.current !== audio
        ) return;
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        currentAudioRef.current = null;
        if (currentAudioUrl.current === audioUrl) cleanupAudioUrl();
        const error = new Error("音訊播放失敗");
        if (onError) {
          onError(error);
        } else {
          console.error(error);
        }
      };

      try {
        await audio.play();
      } catch (error) {
        if (
          isCurrentOperation(generation)
          && currentAudioRef.current === audio
        ) {
          currentAudioRef.current = null;
          if (currentAudioUrl.current === audioUrl) cleanupAudioUrl();
          setIsSpeaking(false);
          setIsLoadingAudio(false);
        }
        throw error;
      }
    },
    [cleanupAudioUrl, isCurrentOperation],
  );

  const speakWithAPI = useCallback(
    async (text: string, generation: number) => {
      const controller = new AbortController();
      ttsAbortRef.current = controller;

      try {
        if (!isCurrentOperation(generation)) return;
        setIsLoadingAudio(true);
        setIsSpeaking(false);

        const blob = await fetchTTSBlob(
          text,
          speechRate,
          ttsEngine,
          controller.signal,
        );
        if (!isCurrentOperation(generation)) return;
        if (ttsAbortRef.current === controller) ttsAbortRef.current = null;
        await playAudioBlob(blob, generation);
      } catch (err: unknown) {
        if (!isCurrentOperation(generation) || isAbortError(err)) return;
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        const message = err instanceof Error ? err.message : "TTS API 呼叫失敗";
        throw new Error(message);
      }
    },
    [
      speechRate,
      ttsEngine,
      isCurrentOperation,
      playAudioBlob,
    ],
  );

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      stopSpeaking();
      const generation = speechGenerationRef.current;

      if (ttsMode === "api") {
        speakWithAPI(text, generation).catch((err) => {
          console.error("TTS API error:", err);
        });
      } else {
        if (!speechSupported) return;
        const voice = pickEnglishVoice();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voice?.lang || "en-US";
        utterance.voice = voice || null;
        utterance.rate = speechRate;
        utterance.onend = () => {
          if (isCurrentOperation(generation)) setIsSpeaking(false);
        };
        utterance.onerror = () => {
          if (isCurrentOperation(generation)) setIsSpeaking(false);
        };
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
      isCurrentOperation,
    ],
  );

  // Async version of speak that returns a Promise resolving when speech ends
  const speakAsync = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;

      stopSpeaking();
      const generation = speechGenerationRef.current;

      if (ttsMode === "api") {
        return new Promise((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            if (isCurrentOperation(generation)) stopSpeaking();
          }, SPEECH_TIMEOUT_MS);
          pendingAsyncRef.current = {
            generation,
            timeoutId,
            resolve,
            reject,
          };

          const controller = new AbortController();
          ttsAbortRef.current = controller;

          (async () => {
            try {
              setIsLoadingAudio(true);
              setIsSpeaking(false);

              const blob = await fetchTTSBlob(
                text,
                speechRate,
                ttsEngine,
                controller.signal,
              );
              if (!isCurrentOperation(generation)) return;
              if (ttsAbortRef.current === controller) ttsAbortRef.current = null;

              await playAudioBlob(
                blob,
                generation,
                () => {
                  settleAsyncSpeech(generation);
                },
                (err) => {
                  settleAsyncSpeech(generation, err);
                },
              );
            } catch (err) {
              if (!isCurrentOperation(generation)) return;
              if (isAbortError(err)) return settleAsyncSpeech(generation);
              setIsSpeaking(false);
              setIsLoadingAudio(false);
              settleAsyncSpeech(
                generation,
                err instanceof Error ? err : new Error("TTS API 呼叫失敗"),
              );
            }
          })();
        });
      } else {
        // Browser speech synthesis mode
        if (!speechSupported) return;

        return new Promise((resolve) => {
          const timeoutId = window.setTimeout(() => {
            if (isCurrentOperation(generation)) stopSpeaking();
          }, SPEECH_TIMEOUT_MS);
          pendingAsyncRef.current = {
            generation,
            timeoutId,
            resolve,
            reject: () => resolve(),
          };

          const voice = pickEnglishVoice();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = voice?.lang || "en-US";
          utterance.voice = voice || null;
          utterance.rate = speechRate;

          utterance.onend = () => {
            if (!isCurrentOperation(generation)) return;
            setIsSpeaking(false);
            settleAsyncSpeech(generation);
          };

          utterance.onerror = () => {
            if (!isCurrentOperation(generation)) return;
            setIsSpeaking(false);
            settleAsyncSpeech(generation);
          };

          setIsSpeaking(true);
          window.speechSynthesis.speak(utterance);
        });
      }
    },
    [
      pickEnglishVoice,
      speechRate,
      ttsEngine,
      speechSupported,
      ttsMode,
      stopSpeaking,
      isCurrentOperation,
      playAudioBlob,
      settleAsyncSpeech,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopSpeaking();
    };
  }, [stopSpeaking]);

  const value: SpeechContextType = useMemo(
    () => ({
      speechRate,
      isSpeaking,
      ttsMode,
      ttsEngine,
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
      ttsEngine,
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
