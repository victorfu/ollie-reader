import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../../hooks/useAuth";
import { logger } from "../../../utils/logger";
import { getLevel } from "./data/levels";
import { applyRunResult, type RunOutcome } from "./engine/progress";
import {
  clearCache,
  createEmptySave,
  mergeSaves,
  readCache,
  settleCloudRunResult,
  syncCloudProgress,
  writeCache,
  type SweetheartSaveV1,
  type SyncStatus,
} from "./storage";

export type CampaignSave = {
  save: SweetheartSaveV1;
  status: SyncStatus;
  /** 有登入才會同步到雲端；沒登入就只存這台裝置。 */
  isSignedIn: boolean;
  /** 最近一次離線恢復同步，讓仍開著的結算視窗補上實際入帳代幣。 */
  lastRecovery: {
    id: number;
    coinsEarned: number;
    requestIds: readonly number[];
  } | null;
  /** 回傳本次代幣與是否需稍後同步，讓結算頁能明確結束 pending 狀態。 */
  recordResult: (
    levelId: string,
    outcome: RunOutcome,
  ) => Promise<{
    coinsEarned: number;
    deferred: boolean;
    recoveryRequestId?: number;
  }>;
};

type SaveSession = {
  uid: string | null;
  save: SweetheartSaveV1;
  status: SyncStatus;
};

const SYNC_RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000] as const;

type OwnerToken = { uid: string | null };

function localSession(uid: string | null): SaveSession {
  const local = readCache(uid) ?? createEmptySave();
  const guest = uid ? readCache(null) : null;
  return {
    uid,
    save: guest ? mergeSaves(local, guest) : local,
    status: uid ? "loading" : "idle",
  };
}

function includesProgress(
  container: SweetheartSaveV1,
  candidate: SweetheartSaveV1,
): boolean {
  return (
    Object.entries(candidate.levelStars).every(
      ([levelId, stars]) => (container.levelStars[levelId] ?? 0) >= stars,
    )
    && Object.entries(candidate.bestWave).every(
      ([levelId, wave]) => (container.bestWave[levelId] ?? 0) >= wave,
    )
    && candidate.claimedClear.every((levelId) => (
      container.claimedClear.includes(levelId)
    ))
    && candidate.claimedThreeStars.every((levelId) => (
      container.claimedThreeStars.includes(levelId)
    ))
  );
}

/**
 * 闖關進度的存取。
 *
 * 先讀本機快取讓畫面立刻有東西，再去雲端拿，兩份用 mergeSaves 合起來——進度
 * 只會往前，所以合併不會有衝突，兩台裝置各自的進度都留得住。
 *
 * 沒登入時一樣存本機（key 是 guest）；之後登入了，雲端載入會把記憶體裡這份
 * guest 進度一起併進帳號存檔，小孩先玩了半天才想到要登入也不會白玩。
 */
export function useCampaignSave(): CampaignSave {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [session, setSession] = useState<SaveSession>(() => localSession(uid));
  const [recovery, setRecovery] = useState<{
    uid: string;
    id: number;
    coinsEarned: number;
    requestIds: readonly number[];
  } | null>(null);
  const recoverySequenceRef = useRef(0);
  const recoveryRequestSequenceRef = useRef(0);
  const recoveryRequestsRef = useRef(new Map<string, Set<number>>());
  const ownerTokenRef = useRef<OwnerToken | null>(null);
  const cloudOperationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const requestRecoveryRetryRef = useRef<(() => void) | null>(null);
  // uid 改變後的第一個 render 就只呈現新身份的本機資料；layout effect 會在使用者
  // 能互動前把 state/ref 一起切過去，避免一幀的前帳號進度可被點擊或寫回。
  const visibleSession = useMemo(
    () => (session.uid === uid ? session : localSession(uid)),
    [session, uid],
  );
  const sessionRef = useRef(visibleSession);
  useLayoutEffect(() => {
    sessionRef.current = visibleSession;
  }, [visibleSession]);

  // The hook can unmount without ever rendering the next auth user. Every
  // queued operation captures this token so it cannot start a request with a
  // later account's Firebase credentials, even if the uid eventually cycles
  // back to the same string.
  useLayoutEffect(() => {
    const token: OwnerToken = { uid };
    ownerTokenRef.current = token;
    return () => {
      if (ownerTokenRef.current === token) ownerTokenRef.current = null;
    };
  }, [uid]);

  const replaceSession = useCallback((next: SaveSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  // Cloud progress sync and a live battle settlement can both claim the same
  // reward. Keep them FIFO within this hook: the transaction queued first gets
  // to finish, and a rejection never poisons later work in the queue.
  const enqueueCloudOperation = useCallback(
    <T,>(operation: () => Promise<T>): Promise<T> => {
      const result = cloudOperationQueueRef.current.then(operation, operation);
      cloudOperationQueueRef.current = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    [],
  );

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    let inFlight = false;
    let rerunRequested = false;
    let requestSequence = 0;
    let recoveredCoinsInCycle = 0;
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const ownerToken = ownerTokenRef.current;

    const active =
      sessionRef.current.uid === uid ? sessionRef.current : localSession(uid);
    // 訪客進度只搬給這次登入的帳號一次。先落到帳號快取再清 guest，即使離線，
    // 進度仍留在這個帳號，而不會在下一次登入時又複製給另一個人。
    const local = writeCache(uid, active.save);
    const stored = readCache(uid);
    if (stored && includesProgress(stored, active.save)) clearCache(null);
    replaceSession({ uid, save: local, status: "loading" });

    const isOwnerActive = () => (
      !cancelled
      && ownerToken !== null
      && ownerTokenRef.current === ownerToken
      && sessionRef.current.uid === uid
    );
    const clearRetryTimer = () => {
      if (retryTimer === null) return;
      clearTimeout(retryTimer);
      retryTimer = null;
    };
    const scheduleRetry = () => {
      if (!isOwnerActive() || retryTimer !== null) return;
      const delay = SYNC_RETRY_DELAYS_MS[
        Math.min(retryAttempt, SYNC_RETRY_DELAYS_MS.length - 1)
      ];
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        runSync("saving");
      }, delay);
    };
    const runSync = (pendingStatus: "loading" | "saving" = "saving") => {
      if (!isOwnerActive()) return;
      if (inFlight) {
        rerunRequested = true;
        return;
      }

      inFlight = true;
      const sequence = ++requestSequence;
      const localAtStart = writeCache(uid, sessionRef.current.save);
      const recoveryRequestsAtStart = new Set(
        recoveryRequestsRef.current.get(uid) ?? [],
      );
      replaceSession({ uid, save: localAtStart, status: pendingStatus });

      // transaction 會 merge 最新雲端，並補發訪客／離線時尚未 claim 的獎勵；
      // online/focus 重送仍是冪等的，不會重複發幣。
      void enqueueCloudOperation(async () => {
        if (!isOwnerActive() || sequence !== requestSequence) return null;
        return syncCloudProgress(uid, localAtStart);
      })
        .then((cloud) => {
          if (!cloud || !isOwnerActive() || sequence !== requestSequence) return;
          retryAttempt = 0;
          clearRetryTimer();
          const persisted = writeCache(uid, cloud.save);
          const needsRerun = !includesProgress(cloud.save, persisted);
          recoveredCoinsInCycle += cloud.coinsEarned;
          const currentRecoveryRequests = recoveryRequestsRef.current.get(uid);
          const handledRecoveryRequests = currentRecoveryRequests
            ? [...recoveryRequestsAtStart].filter((requestId) => (
              currentRecoveryRequests.has(requestId)
            ))
            : [];
          replaceSession({
            uid,
            save: persisted,
            status: needsRerun ? "saving" : "saved",
          });
          if (!needsRerun) {
            if (handledRecoveryRequests.length > 0) {
              setRecovery({
                uid,
                id: ++recoverySequenceRef.current,
                coinsEarned: recoveredCoinsInCycle,
                requestIds: handledRecoveryRequests,
              });
            }
            recoveredCoinsInCycle = 0;
            for (const requestId of handledRecoveryRequests) {
              currentRecoveryRequests?.delete(requestId);
            }
            if (currentRecoveryRequests?.size === 0) {
              recoveryRequestsRef.current.delete(uid);
            }
          }
          if (needsRerun) rerunRequested = true;
        })
        .catch((error) => {
          if (!isOwnerActive() || sequence !== requestSequence) return;
          logger.warn(
            "甜心防衛隊：讀取雲端存檔失敗，改用本機進度",
            error,
          );
          // 同步期間可能又完成一場；從最新 cache union，不能拿啟動時快照洗回去。
          const fallback = writeCache(uid, sessionRef.current.save);
          replaceSession({ uid, save: fallback, status: "offline" });
          scheduleRetry();
        })
        .finally(() => {
          if (sequence === requestSequence) inFlight = false;
          if (!isOwnerActive() || !rerunRequested || inFlight) return;
          rerunRequested = false;
          runSync("saving");
        });
    };

    const retrySync = () => {
      clearRetryTimer();
      runSync("saving");
    };
    const requestRecoveryRetry = () => scheduleRetry();
    requestRecoveryRetryRef.current = requestRecoveryRetry;
    window.addEventListener("online", retrySync);
    window.addEventListener("focus", retrySync);
    runSync("loading");

    return () => {
      cancelled = true;
      requestSequence += 1;
      clearRetryTimer();
      if (requestRecoveryRetryRef.current === requestRecoveryRetry) {
        requestRecoveryRetryRef.current = null;
      }
      window.removeEventListener("online", retrySync);
      window.removeEventListener("focus", retrySync);
    };
  }, [enqueueCloudOperation, replaceSession, uid]);

  const recordResult = useCallback(
    async (
      levelId: string,
      outcome: RunOutcome,
    ): Promise<{
      coinsEarned: number;
      deferred: boolean;
      recoveryRequestId?: number;
    }> => {
      const active = sessionRef.current;
      const ownerToken = ownerTokenRef.current;
      const isOwnerActive = () => (
        ownerToken !== null
        && ownerTokenRef.current === ownerToken
        && ownerToken.uid === uid
        && sessionRef.current.uid === uid
      );
      // auth 剛切換但 layout effect 尚未執行的防線；絕不把舊 session 寫到新 key。
      if (active.uid !== uid || !isOwnerActive()) {
        return { coinsEarned: 0, deferred: true };
      }

      const reward = getLevel(levelId)?.coinReward ?? { clear: 0, threeStars: 0 };
      const { progress } = applyRunResult(
        active.save,
        levelId,
        outcome,
        reward,
      );
      if (progress === active.save) {
        return { coinsEarned: 0, deferred: false };
      }

      const next: SweetheartSaveV1 = {
        ...active.save,
        ...progress,
        updatedAt: Date.now(),
      };

      if (!uid) {
        // 訪客沒有 coin wallet；先記星數但不 claim、不顯示已入帳。登入後的
        // syncCloudProgress 會依星數在同一筆 transaction 補發並寫 claim。
        const persisted = writeCache(null, {
          ...next,
          claimedClear: active.save.claimedClear,
          claimedThreeStars: active.save.claimedThreeStars,
        });
        replaceSession({ uid: null, save: persisted, status: "idle" });
        return { coinsEarned: 0, deferred: false };
      }

      // 星數與最遠波次先落本機，但新的 claim 要等 coin balance 在同一筆 transaction
      // 成功後才寫。離線失敗時下次重打仍能領，不會只記「領過」卻沒拿到錢。
      const optimistic = writeCache(uid, {
        ...next,
        claimedClear: active.save.claimedClear,
        claimedThreeStars: active.save.claimedThreeStars,
      });
      replaceSession({ uid, save: optimistic, status: "saving" });

      // Register before entering the FIFO. A sync already ahead of this
      // settlement must not consume it, while a sync queued afterwards can
      // report recovery if this transaction fails or loses its response.
      const recoveryRequestId = ++recoveryRequestSequenceRef.current;
      const recoveryRequests = recoveryRequestsRef.current.get(uid)
        ?? new Set<number>();
      recoveryRequests.add(recoveryRequestId);
      recoveryRequestsRef.current.set(uid, recoveryRequests);

      try {
        const committed = await enqueueCloudOperation(async () => {
          if (!isOwnerActive()) return null;
          return settleCloudRunResult(
            uid,
            active.save,
            levelId,
            outcome,
            reward,
          );
        });
        if (!committed || !isOwnerActive()) {
          return { coinsEarned: 0, deferred: true };
        }
        const persisted = writeCache(uid, committed.save);
        replaceSession({ uid, save: persisted, status: "saved" });
        recoveryRequests.delete(recoveryRequestId);
        if (recoveryRequests.size === 0) {
          recoveryRequestsRef.current.delete(uid);
        }
        return { coinsEarned: committed.coinsEarned, deferred: false };
      } catch (error) {
        logger.warn("甜心防衛隊：提交進度與扭蛋代幣失敗，進度留在本機", error);
        if (isOwnerActive()) {
          // 另一個並行結算可能已先成功；cache merge 會保住它剛寫下的 claims。
          const fallback = writeCache(uid, optimistic);
          replaceSession({ uid, save: fallback, status: "offline" });
          requestRecoveryRetryRef.current?.();
        }
        return {
          coinsEarned: 0,
          deferred: true,
          recoveryRequestId,
        };
      }
    },
    [enqueueCloudOperation, replaceSession, uid],
  );

  return {
    save: visibleSession.save,
    // 沒登入就沒有雲端狀態可言，畫面改提示「只存在這台裝置」。
    status: visibleSession.status,
    isSignedIn: uid !== null,
    lastRecovery:
      recovery?.uid === uid
        ? {
            id: recovery.id,
            coinsEarned: recovery.coinsEarned,
            requestIds: recovery.requestIds,
          }
        : null,
    recordResult,
  };
}
