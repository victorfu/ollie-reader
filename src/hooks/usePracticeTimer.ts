import { useState, useRef, useCallback, useEffect } from "react";

interface UsePracticeTimerResult {
  time: number;
  isRunning: boolean;
  isPaused: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

export function usePracticeTimer(): UsePracticeTimerResult {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    startTimeRef.current = Date.now() - elapsedRef.current * 1000;

    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTime(elapsed);
      elapsedRef.current = elapsed;
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    elapsedRef.current = 0;
    setTime(0);
    setIsRunning(true);
    setIsPaused(false);
    startTimer();
  }, [startTimer]);

  const pause = useCallback(() => {
    if (isRunning && !isPaused) {
      stopTimer();
      setIsPaused(true);
    }
  }, [isRunning, isPaused, stopTimer]);

  const resume = useCallback(() => {
    if (isRunning && isPaused) {
      setIsPaused(false);
      startTimer();
    }
  }, [isRunning, isPaused, startTimer]);

  const stop = useCallback(() => {
    stopTimer();
    setIsRunning(false);
    setIsPaused(false);
  }, [stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    setTime(0);
    elapsedRef.current = 0;
    setIsRunning(false);
    setIsPaused(false);
  }, [stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  return {
    time,
    isRunning,
    isPaused,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
