import { useState, useCallback, useEffect, type ReactNode } from "react";
import type { TTSMode } from "../types/pdf";
import { SpeechContext, type SpeechContextType } from "./SpeechContextType";
import { TTS_API_URL } from "../constants/api";

interface SpeechProviderProps {
  children: ReactNode;
}

export const SpeechProvider = ({ children }: SpeechProviderProps) => {
  const [speechRate, setSpeechRate] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsMode, setTtsMode] = useState<TTSMode>("browser");
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(
    null,
  );
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

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
  }, [speechSupported, currentAudio]);

  const speakWithAPI = useCallback(
    async (text: string) => {
      try {
        setIsLoadingAudio(true);
        setIsSpeaking(false);

        const response = await fetch(TTS_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
            speaker: "0",
            length_scale: speechRate.toString(),
            noise_scale: "0.667",
            noise_w: "0.8",
          }),
        });

        if (!response.ok) {
          throw new Error(`TTS API 錯誤: ${response.status}`);
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);

        setIsLoadingAudio(false);

        const audio = new Audio(audioUrl);
        setCurrentAudio(audio);
        setIsSpeaking(true);

        audio.onended = () => {
          setIsSpeaking(false);
          setCurrentAudio(null);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          setIsLoadingAudio(false);
          setCurrentAudio(null);
          URL.revokeObjectURL(audioUrl);
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

  const value: SpeechContextType = {
    speechRate,
    setSpeechRate,
    isSpeaking,
    ttsMode,
    setTtsMode,
    isLoadingAudio,
    speechSupported,
    speak,
    stopSpeaking,
  };

  return (
    <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>
  );
};
