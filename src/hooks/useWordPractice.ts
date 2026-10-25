import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import type {
  HistoryHomework,
  Homework,
  HomeworkProgress,
  PracticeSettings,
  WordPracticeState,
} from "../types/wordPractice";
import { generateHomework } from "../services/wordPracticeService";
import {
  abandonHomework,
  completeHomework,
  getActiveHomework,
  listCompletedHomeworks,
  loadPracticeState,
  saveHomeworkProgress,
  saveSettings as saveSettingsToStorage,
} from "../services/wordPracticeStorage";
import { updateReviewStats } from "../services/vocabularyService";
import { dueReviewKeys, DEFAULT_SETTINGS } from "../utils/reviewSchedule";
import { logger } from "../utils/logger";

export interface UseWordPractice {
  status: "loading" | "ready" | "error";
  /** Message for the page: a failed load (with `status` "error") or a failed start, abandon, submit or settings save. */
  error: string | null;
  active: Homework | null;
  history: HistoryHomework[];
  settings: PracticeSettings;
  /** Reviews due now, capped by `settings.reviewLimit`. */
  reviewDueCount: number;
  starting: boolean;
  /** Set while the latest progress is not on the server; the next `updateProgress` retries. */
  saveError: string | null;
  start(): Promise<"created" | "empty" | "failed">;
  /**
   * Replaces the active homework's progress with the full, latest value and
   * saves it. Ignored while `submit` or `abandon` is running, so the last
   * answer must be recorded before `submit` is called.
   */
  updateProgress(next: HomeworkProgress): void;
  submit(): Promise<Homework | null>;
  abandon(): Promise<void>;
  saveSettings(next: PracticeSettings): Promise<void>;
  /**
   * Sets `status` back to "loading" and replaces the state, `active` and
   * `history` with the server's copy. Meant for retrying after a failed load;
   * calling it from "ready" drops the page back to the loading state.
   */
  reload(): Promise<void>;
}

const LOAD_ERROR = "載入單字練習失敗，請稍後再試";
const GENERATE_ERROR = "準備功課失敗，請稍後再試";
const ABANDON_ERROR = "放棄功課失敗，請稍後再試";
const FINISH_ERROR = "無法完成功課，請稍後再試";
const SETTINGS_ERROR = "儲存設定失敗，請稍後再試";
const SAVE_ERROR = "進度尚未儲存，下一次作答時會再試一次";

/**
 * Bookkeeping for one homework's progress saves. A new tracker is made
 * whenever a different homework becomes active. A queued save is bound to the
 * tracker it was queued for, which holds the account, the homework id and the
 * latest progress, so it still saves that homework's answers after another
 * homework became active or the page unmounted.
 *
 * - `open`: answers are accepted and saved.
 * - `finishing`: the homework is being submitted. Answers are ignored, but the
 *   last save may still run.
 * - `abandoning`: the homework is being given up. Answers are ignored and no
 *   further save is made.
 */
interface ProgressTracker {
  uid: string;
  id: string;
  /** The latest progress, which is what the next save sends. */
  progress: HomeworkProgress;
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
  const [history, setHistory] = useState<HistoryHomework[]>([]);
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [reviewDueCount, setReviewDueCount] = useState(0);
  const [starting, setStarting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs hold what the async operations need to read at the moment they run.
  const uidRef = useRef<string | undefined>(undefined);
  /** Bumped when the account changes or the hook unmounts, which makes every running operation stale. */
  const sessionRef = useRef(0);
  const activeRef = useRef<Homework | null>(null);
  const trackerRef = useRef<ProgressTracker | null>(null);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const loadTicketRef = useRef(0);
  const startingRef = useRef(false);
  const submitRef = useRef<Promise<Homework | null> | null>(null);
  /** The stored word states, kept to recompute the due count when the limit changes. */
  const reviewWordsRef = useRef<WordPracticeState["words"]>({});

  const applyPracticeState = useCallback((state: WordPracticeState, now: number) => {
    reviewWordsRef.current = state.words;
    setSettings(state.settings);
    setReviewDueCount(dueReviewKeys(state.words, now, state.settings.reviewLimit).length);
  }, []);

  const installActive = useCallback((next: Homework | null, ownerUid?: string) => {
    trackerRef.current =
      next && ownerUid
        ? {
            uid: ownerUid,
            id: next.id,
            progress: { pages: next.pages, dictation: next.dictation, corrections: next.corrections },
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
      const now = Date.now();
      const [state, activeHomework, completed] = await Promise.all([
        loadPracticeState(ownerUid, now),
        getActiveHomework(ownerUid),
        listCompletedHomeworks(ownerUid),
      ]);
      if (isStale()) return;
      applyPracticeState(state, now);
      installActive(activeHomework, ownerUid);
      setHistory(completed);
      setStatus("ready");
    } catch (err) {
      if (isStale()) return;
      logger.error("Could not load word practice:", err);
      setError(LOAD_ERROR);
      setStatus("error");
    }
  }, [applyPracticeState, installActive]);

  const start = useCallback(async (): Promise<"created" | "empty" | "failed"> => {
    const ownerUid = uidRef.current;
    if (!ownerUid || startingRef.current) return "failed";
    const session = sessionRef.current;
    const isCancelled = () => sessionRef.current !== session;

    startingRef.current = true;
    setStarting(true);
    setError(null);
    try {
      const result = await generateHomework(ownerUid);
      if (isCancelled()) return "failed";
      if (result.status === "empty") return "empty";
      // The service has already abandoned the previous homework on the server,
      // so its progress must not be saved any more. A homework that is being
      // submitted keeps its tracker: its last save still has to run.
      const previous = trackerRef.current;
      if (previous?.phase === "open") previous.phase = "abandoning";
      installActive(result.homework, ownerUid);
      return "created";
    } catch (err) {
      if (isCancelled()) return "failed";
      logger.error("Could not start word practice homework:", err);
      setError(GENERATE_ERROR);
      return "failed";
    } finally {
      if (sessionRef.current === session) {
        startingRef.current = false;
        setStarting(false);
      }
    }
  }, [installActive]);

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
    (next: HomeworkProgress): void => {
      const homework = activeRef.current;
      const tracker = trackerRef.current;
      if (!homework || !tracker || tracker.phase !== "open") return;

      const updated: Homework = { ...homework, ...next };
      activeRef.current = updated;
      setActive(updated);
      tracker.progress = next;
      tracker.version += 1;
      void queueSave(tracker);
    },
    [queueSave],
  );

  const submit = useCallback((): Promise<Homework | null> => {
    if (submitRef.current) return submitRef.current;
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
      let completed: Homework;
      let reviewUpdates: { vocabularyId: string; remembered: boolean }[];
      try {
        // Completing reads the server's copy of the answers, so the last one
        // has to be there first.
        if (!(await queueSave(tracker))) throw new Error("The latest progress could not be saved");
        ({ homework: completed, reviewUpdates } = await completeHomework(
          ownerUid,
          homework.id,
          Date.now(),
        ));
      } catch (err) {
        tracker.phase = "open";
        if (sessionRef.current !== session) return null;
        logger.error("Could not submit word practice homework:", err);
        setError(FINISH_ERROR);
        return null;
      }

      if (sessionRef.current === session) {
        if (trackerRef.current === tracker) installActive(null);
        setHistory((previous) => [
          completed,
          ...previous.filter((item) => item.id !== completed.id),
        ]);
      }

      // The homework is done; the vocabulary review stats are best effort.
      for (const update of reviewUpdates) {
        try {
          await updateReviewStats(update.vocabularyId, update.remembered);
        } catch (err) {
          logger.error("Could not update vocabulary review stats:", err);
        }
      }
      try {
        const now = Date.now();
        const state = await loadPracticeState(ownerUid, now);
        if (sessionRef.current === session) applyPracticeState(state, now);
      } catch (err) {
        logger.error("Could not refresh the word practice review count:", err);
      }
      return completed;
    };
    const run: Promise<Homework | null> = complete().finally(() => {
      if (submitRef.current === run) submitRef.current = null;
    });
    submitRef.current = run;
    return run;
  }, [applyPracticeState, installActive, queueSave]);

  const saveSettings = useCallback(async (next: PracticeSettings): Promise<void> => {
    const ownerUid = uidRef.current;
    if (!ownerUid) return;
    const session = sessionRef.current;
    setError(null);
    try {
      await saveSettingsToStorage(ownerUid, next);
      if (sessionRef.current !== session) return;
      setSettings(next);
      setReviewDueCount(dueReviewKeys(reviewWordsRef.current, Date.now(), next.reviewLimit).length);
    } catch (err) {
      if (sessionRef.current !== session) return;
      logger.error("Could not save word practice settings:", err);
      setError(SETTINGS_ERROR);
    }
  }, []);

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
    setStarting(false);
    setSettings(DEFAULT_SETTINGS);
    setReviewDueCount(0);
    reviewWordsRef.current = {};
    if (!uid) return undefined;

    void load();
    return () => {
      sessionRef.current += 1;
      uidRef.current = undefined;
      startingRef.current = false;
      submitRef.current = null;
    };
  }, [uid, load]);

  return {
    status,
    error,
    active,
    history,
    settings,
    reviewDueCount,
    starting,
    saveError,
    start,
    updateProgress,
    submit,
    abandon,
    saveSettings,
    reload: load,
  };
}
