import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import type { Homework, HomeworkOptions, HomeworkWordProgress } from "../types/wordPractice";
import { fillMissingSentences, generateHomework } from "../services/wordPracticeService";
import {
  abandonHomework,
  completeHomework,
  getActiveHomework,
  listCompletedHomeworks,
  saveHomeworkProgress,
} from "../services/wordPracticeStorage";
import { isAbortError } from "../utils/errorUtils";
import { logger } from "../utils/logger";

export interface UseWordPractice {
  status: "loading" | "ready" | "error";
  /** Message for the page: a failed load (with `status` "error") or a failed generate, abandon or finish. */
  error: string | null;
  active: Homework | null;
  history: Homework[];
  generating: boolean;
  /** Set while the latest progress is not on the server; the next `updateProgress` retries. */
  saveError: string | null;
  generate(options: HomeworkOptions): Promise<"created" | "empty" | "failed">;
  abandon(): Promise<void>;
  /**
   * Replaces the active homework's progress with the full, latest array and
   * saves it. Ignored while `finishTest` or `abandon` is running, so the last
   * answer must be recorded before `finishTest` is called.
   */
  updateProgress(next: HomeworkWordProgress[]): void;
  ensureSentences(): Promise<void>;
  finishTest(): Promise<Homework | null>;
  /**
   * Sets `status` back to "loading" and replaces `active` and `history` with
   * the server's copy. Meant for retrying after a failed load; calling it from
   * "ready" drops the page back to the loading state.
   */
  reload(): Promise<void>;
}

const LOAD_ERROR = "載入單字練習失敗，請稍後再試";
const GENERATE_ERROR = "產生功課失敗，請稍後再試";
const ABANDON_ERROR = "放棄功課失敗，請稍後再試";
const FINISH_ERROR = "無法完成功課，請稍後再試";
const SAVE_ERROR = "進度尚未儲存，下一次作答時會再試一次";

/**
 * Bookkeeping for one homework's progress saves. A new tracker is made
 * whenever a different homework becomes active. A queued save is bound to the
 * tracker it was queued for, which holds the account, the homework id and the
 * latest progress, so it still saves that homework's answers after another
 * homework became active or the page unmounted.
 *
 * - `open`: answers are accepted and saved.
 * - `finishing`: the test is being completed. Answers are ignored, but the
 *   last save may still run.
 * - `abandoning`: the homework is being given up. Answers are ignored and no
 *   further save is made.
 */
interface ProgressTracker {
  uid: string;
  id: string;
  /** The latest progress, which is what the next save sends. */
  progress: HomeworkWordProgress[];
  /** Counts `updateProgress` calls; `savedVersion` is the last count known to be on the server. */
  version: number;
  savedVersion: number;
  phase: "open" | "finishing" | "abandoning";
}

export function useWordPractice(): UseWordPractice {
  const { user } = useAuth();
  const uid = user?.uid;

  const [status, setStatus] = useState<UseWordPractice["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Homework | null>(null);
  const [history, setHistory] = useState<Homework[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs hold what the async operations need to read at the moment they run.
  const uidRef = useRef<string | undefined>(undefined);
  /** Bumped when the account changes or the hook unmounts, which makes every running operation stale. */
  const sessionRef = useRef(0);
  const activeRef = useRef<Homework | null>(null);
  const trackerRef = useRef<ProgressTracker | null>(null);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const loadTicketRef = useRef(0);
  const generatingRef = useRef(false);
  const finishRef = useRef<Promise<Homework | null> | null>(null);
  const sentenceAttemptsRef = useRef(new Set<string>());
  const abortControllersRef = useRef(new Set<AbortController>());

  const installActive = useCallback((next: Homework | null, ownerUid?: string) => {
    trackerRef.current =
      next && ownerUid
        ? {
            uid: ownerUid,
            id: next.id,
            progress: next.progress,
            version: 0,
            savedVersion: 0,
            phase: "open",
          }
        : null;
    activeRef.current = next;
    setActive(next);
    setSaveError(null);
  }, []);

  /**
   * Queues a save of the tracker's latest progress behind the saves already
   * queued, so writes never overlap. The link reads the progress when it runs
   * and does nothing when that progress is already on the server. Resolves to
   * whether the latest progress is saved. Never rejects.
   */
  const queueSave = useCallback((tracker: ProgressTracker): Promise<boolean> => {
    const session = sessionRef.current;
    const link = saveChainRef.current.then(async (): Promise<boolean> => {
      if (tracker.phase === "abandoning" || tracker.savedVersion === tracker.version) return true;

      const { version, progress } = tracker;
      // Only the page that queued the save may show its outcome.
      const isShown = () => sessionRef.current === session && trackerRef.current === tracker;
      try {
        await saveHomeworkProgress(tracker.uid, tracker.id, progress);
        tracker.savedVersion = version;
        if (isShown()) setSaveError(null);
        return true;
      } catch (err) {
        logger.error("Could not save word practice progress:", err);
        if (isShown()) setSaveError(SAVE_ERROR);
        return false;
      }
    });
    saveChainRef.current = link;
    return link;
  }, []);

  const load = useCallback(async (): Promise<void> => {
    const ownerUid = uidRef.current;
    if (!ownerUid) return;
    const session = sessionRef.current;
    const ticket = ++loadTicketRef.current;
    const isStale = () => sessionRef.current !== session || loadTicketRef.current !== ticket;

    setStatus("loading");
    setError(null);
    try {
      // Re-reading must not overwrite progress that is still on its way to the server.
      await saveChainRef.current;
      const [activeHomework, completed] = await Promise.all([
        getActiveHomework(ownerUid),
        listCompletedHomeworks(ownerUid),
      ]);
      if (isStale()) return;
      installActive(activeHomework, ownerUid);
      setHistory(completed);
      setStatus("ready");
    } catch (err) {
      if (isStale()) return;
      logger.error("Could not load word practice:", err);
      setError(LOAD_ERROR);
      setStatus("error");
    }
  }, [installActive]);

  const generate = useCallback(
    async (options: HomeworkOptions): Promise<"created" | "empty" | "failed"> => {
      const ownerUid = uidRef.current;
      if (!ownerUid || generatingRef.current) return "failed";
      const session = sessionRef.current;
      const controller = new AbortController();
      abortControllersRef.current.add(controller);
      const isCancelled = () => controller.signal.aborted || sessionRef.current !== session;

      generatingRef.current = true;
      setGenerating(true);
      setError(null);
      try {
        const result = await generateHomework(ownerUid, options, controller.signal);
        if (isCancelled()) return "failed";
        if (result.status === "empty") return "empty";
        // The service has already abandoned the previous homework on the server.
        installActive(result.homework, ownerUid);
        return "created";
      } catch (err) {
        if (isAbortError(err) || isCancelled()) return "failed";
        logger.error("Could not generate word practice homework:", err);
        setError(GENERATE_ERROR);
        return "failed";
      } finally {
        abortControllersRef.current.delete(controller);
        if (sessionRef.current === session) {
          generatingRef.current = false;
          setGenerating(false);
        }
      }
    },
    [installActive],
  );

  const abandon = useCallback(async (): Promise<void> => {
    const ownerUid = uidRef.current;
    const homework = activeRef.current;
    const tracker = trackerRef.current;
    if (!ownerUid || !homework || !tracker || tracker.phase !== "open") return;
    const session = sessionRef.current;

    // From here on no save is made for this homework, even if the call fails
    // and the homework stays active: it is reopened below in that case.
    tracker.phase = "abandoning";
    setError(null);
    try {
      await abandonHomework(ownerUid, homework.id);
      if (sessionRef.current === session && trackerRef.current === tracker) installActive(null);
    } catch (err) {
      tracker.phase = "open";
      if (sessionRef.current !== session) return;
      logger.error("Could not abandon word practice homework:", err);
      setError(ABANDON_ERROR);
    }
  }, [installActive]);

  const updateProgress = useCallback(
    (next: HomeworkWordProgress[]): void => {
      const homework = activeRef.current;
      const tracker = trackerRef.current;
      if (!homework || !tracker || tracker.phase !== "open") return;

      const updated: Homework = { ...homework, progress: next };
      activeRef.current = updated;
      setActive(updated);
      tracker.progress = next;
      tracker.version += 1;
      void queueSave(tracker);
    },
    [queueSave],
  );

  const ensureSentences = useCallback(async (): Promise<void> => {
    const ownerUid = uidRef.current;
    const homework = activeRef.current;
    if (!ownerUid || !homework || sentenceAttemptsRef.current.has(homework.id)) return;
    // One attempt per homework, even a failed one: the steps work without the sentences.
    sentenceAttemptsRef.current.add(homework.id);

    const session = sessionRef.current;
    const controller = new AbortController();
    abortControllersRef.current.add(controller);
    try {
      const filled = await fillMissingSentences(ownerUid, homework, controller.signal);
      if (sessionRef.current !== session || filled === homework) return;

      const current = activeRef.current;
      if (current?.id !== homework.id) return;
      // Answers may have been entered while the sentences were being fetched.
      const next: Homework =
        current.progress === homework.progress ? filled : { ...current, words: filled.words };
      activeRef.current = next;
      setActive(next);
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) return;
      logger.error("Could not fill in missing example sentences:", err);
    } finally {
      abortControllersRef.current.delete(controller);
    }
  }, []);

  const finishTest = useCallback((): Promise<Homework | null> => {
    if (finishRef.current) return finishRef.current;
    const ownerUid = uidRef.current;
    const homework = activeRef.current;
    const tracker = trackerRef.current;
    if (!ownerUid || !homework || !tracker || tracker.phase !== "open") {
      return Promise.resolve(null);
    }
    const session = sessionRef.current;

    tracker.phase = "finishing";
    setError(null);
    const complete = async (): Promise<Homework | null> => {
      try {
        // Completing reads the server's copy of the test answers, so the last
        // one has to be there first.
        if (!(await queueSave(tracker))) throw new Error("The latest progress could not be saved");
        const completed = await completeHomework(ownerUid, homework.id, Date.now());
        if (sessionRef.current === session) {
          if (trackerRef.current === tracker) installActive(null);
          setHistory((previous) => [
            completed,
            ...previous.filter((item) => item.id !== completed.id),
          ]);
        }
        return completed;
      } catch (err) {
        tracker.phase = "open";
        if (sessionRef.current !== session) return null;
        logger.error("Could not finish word practice test:", err);
        setError(FINISH_ERROR);
        return null;
      }
    };
    const run: Promise<Homework | null> = complete().finally(() => {
      if (finishRef.current === run) finishRef.current = null;
    });
    finishRef.current = run;
    return run;
  }, [installActive, queueSave]);

  useEffect(() => {
    uidRef.current = uid;
    // Whatever the previous account (or the previous mount) left behind is not
    // this account's data. Saves it queued still run for it, bound to their trackers.
    activeRef.current = null;
    trackerRef.current = null;
    setStatus("loading");
    setError(null);
    setSaveError(null);
    setActive(null);
    setHistory([]);
    setGenerating(false);
    if (!uid) return undefined;

    const abortControllers = abortControllersRef.current;
    void load();
    return () => {
      sessionRef.current += 1;
      uidRef.current = undefined;
      for (const controller of abortControllers) controller.abort();
      abortControllers.clear();
      generatingRef.current = false;
      finishRef.current = null;
    };
  }, [uid, load]);

  return {
    status,
    error,
    active,
    history,
    generating,
    saveError,
    generate,
    abandon,
    updateProgress,
    ensureSentences,
    finishTest,
    reload: load,
  };
}
