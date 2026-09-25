import { useEffect, useState } from "react";
import { AUTOSAVE_DELAY_MS } from "../constants/questionBank";
import {
  AutosaveQueue,
  type AutosaveStatus,
  type PendingChanges,
} from "./autosaveQueue";

export interface UseAutosaveOptions {
  commit: (changes: PendingChanges) => Promise<void>;
  /** 只在第一次 render 讀取：呼叫端要在資料載入完成後才掛載。 */
  persistedIds: readonly string[];
  delayMs?: number;
}

export function useAutosave({
  commit,
  persistedIds,
  delayMs = AUTOSAVE_DELAY_MS,
}: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [queue] = useState(
    () =>
      new AutosaveQueue({
        commit,
        persistedIds,
        delayMs,
        onStatusChange: setStatus,
      }),
  );

  useEffect(() => {
    queue.setCommit(commit);
  }, [queue, commit]);

  useEffect(() => {
    queue.start();
    const flushNow = () => {
      void queue.flush();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", flushNow);
      // StrictMode 會清除後再執行一次 effect：這裡先存、再暫停排程，上面的 start() 會恢復。
      flushNow();
      queue.stop();
    };
  }, [queue]);

  return {
    status,
    markUpsert: queue.markUpsert,
    markDelete: queue.markDelete,
    markSourceDirty: queue.markSourceDirty,
    flush: queue.flush,
  };
}
