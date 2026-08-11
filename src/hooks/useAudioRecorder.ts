import { useState, useRef, useCallback, useEffect } from "react";

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

interface UseAudioRecorderResult {
  isRecording: boolean;
  isStarting: boolean;
  isPaused: boolean;
  isFinalizing: boolean;
  recordingTime: number;
  audioUrl: string | null;
  audioBlob: Blob | null;
  isSupported: boolean;
  error: string | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const operationIdRef = useRef(0);
  const startOperationRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const isSupported =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const revokeAudioUrl = useCallback(() => {
    if (!audioUrlRef.current) return;
    URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError("您的瀏覽器不支援錄音功能");
      return false;
    }
    // The state update is asynchronous, so use a ref to reject a second click
    // in the same render while getUserMedia is still pending.
    if (
      startOperationRef.current !== null
      || mediaRecorderRef.current !== null
    ) return false;

    const operationId = ++operationIdRef.current;
    startOperationRef.current = operationId;
    let requestedStream: MediaStream | null = null;
    setIsStarting(true);

    try {
      setError(null);

      // Clean up previous recording
      revokeAudioUrl();
      setAudioUrl(null);
      setAudioBlob(null);
      setIsFinalizing(false);

      requestedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || operationIdRef.current !== operationId) {
        stopMediaStream(requestedStream);
        return false;
      }
      streamRef.current = requestedStream;

      const mediaRecorder = new MediaRecorder(requestedStream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stopMediaStream(requestedStream);
        if (streamRef.current === requestedStream) streamRef.current = null;
        if (mediaRecorderRef.current === mediaRecorder) {
          mediaRecorderRef.current = null;
        }
        if (!mountedRef.current || operationIdRef.current !== operationId) return;

        const mimeType =
          mediaRecorder.mimeType
          || audioChunks.find((chunk) => chunk.type)?.type
          || "audio/webm";
        const blob = new Blob(audioChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        audioUrlRef.current = url;
        setIsFinalizing(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      startTimer();
      return true;
    } catch (err) {
      stopMediaStream(requestedStream);
      if (streamRef.current === requestedStream) streamRef.current = null;
      if (!mountedRef.current || operationIdRef.current !== operationId) {
        return false;
      }
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      setIsFinalizing(false);
      stopTimer();
      console.error("Failed to start recording:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("麥克風權限被拒絕，請允許麥克風權限後重試");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setError("找不到麥克風裝置");
      } else {
        setError("無法開始錄音，請檢查麥克風設定");
      }
      return false;
    } finally {
      if (startOperationRef.current === operationId) {
        startOperationRef.current = null;
        if (mountedRef.current) setIsStarting(false);
      }
    }
  }, [isSupported, revokeAudioUrl, startTimer, stopTimer]);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder) {
      if (mediaRecorder.state !== "inactive") {
        setIsFinalizing(true);
        mediaRecorder.stop();
      }
    } else {
      // getUserMedia cannot be aborted. Invalidate the pending request so that
      // a stream granted after Stop is immediately closed instead of recording
      // in the background.
      operationIdRef.current += 1;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
    startOperationRef.current = null;
    setIsStarting(false);
    setIsRecording(false);
    setIsPaused(false);
    stopTimer();
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.pause();
      setIsPaused(true);
      stopTimer();
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder?.state === "paused") {
      mediaRecorder.resume();
      setIsPaused(false);
      startTimer();
    }
  }, [startTimer]);

  const resetRecording = useCallback(() => {
    operationIdRef.current += 1;
    startOperationRef.current = null;
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    mediaRecorderRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopTimer();
    revokeAudioUrl();

    setIsRecording(false);
    setIsStarting(false);
    setIsPaused(false);
    setIsFinalizing(false);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingTime(0);
    setError(null);
  }, [revokeAudioUrl, stopTimer]);

  // Cleanup on unmount only — read current values from refs
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationIdRef.current += 1;
      startOperationRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const mediaRecorder = mediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      mediaRecorderRef.current = null;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      revokeAudioUrl();
    };
  }, [revokeAudioUrl]);

  return {
    isRecording,
    isStarting,
    isPaused,
    isFinalizing,
    recordingTime,
    audioUrl,
    audioBlob,
    isSupported,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
