import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CircleDollarSign,
  Cloud,
  Gamepad2,
  Info,
  LogIn,
  RefreshCw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  WifiOff,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { ConfirmModal } from "../../common/ConfirmModal";
import { useAuth } from "../../../hooks/useAuth";
import { playSound } from "../../../services/gameService";
import { logger } from "../../../utils/logger";
import { GACHA_CHARACTERS } from "./gachaData";
import {
  DEFAULT_MISS_RATE,
  EMPTY_GACHA_SAVE,
  canTransitionGachaPhase,
  pickGachaOutcome,
  transitionGachaPhase,
} from "./gachaLogic";
import {
  compareGachaSaveVersions,
  getGachaCacheKey,
  isGachaResetConflictError,
  loadGachaCloud,
  parseGachaCacheValue,
  readGachaCache,
  recordGachaAttempt,
  resetGachaCollection,
} from "./gachaStorage";
import type {
  AppliedGachaAttempt,
  GachaDrawResult,
  GachaPhase,
  GachaSaveV1,
  GachaView,
} from "./gachaTypes";
import { GachaCollection } from "./GachaCollection";
import { GachaRevealDialog } from "./GachaRevealDialog";

interface GachaMachineProps {
  onExit: () => void;
}

type GachaAuthState = ReturnType<typeof useAuth>;

interface GachaMachineSessionProps extends GachaMachineProps {
  auth: GachaAuthState;
}

type SyncStatus =
  | "loading"
  | "cache"
  | "cloud"
  | "offline"
  | "offlineEmpty"
  | "error";

const CAPSULE_STYLES = [
  "bg-gradient-to-br from-pink-200 to-rose-400",
  "bg-gradient-to-br from-sky-200 to-cyan-400",
  "bg-gradient-to-br from-amber-200 to-yellow-400",
  "bg-gradient-to-br from-violet-200 to-purple-400",
  "bg-gradient-to-br from-emerald-200 to-green-400",
  "bg-gradient-to-br from-fuchsia-200 to-pink-400",
  "bg-gradient-to-br from-blue-200 to-indigo-400",
  "bg-gradient-to-br from-orange-200 to-amber-400",
] as const;

const DISPENSED_CAPSULE_STYLES = [
  "bg-gradient-to-b from-pink-100 from-50% to-rose-400 to-50%",
  "bg-gradient-to-b from-sky-100 from-50% to-blue-400 to-50%",
  "bg-gradient-to-b from-amber-100 from-50% to-orange-400 to-50%",
  "bg-gradient-to-b from-violet-100 from-50% to-purple-400 to-50%",
  "bg-gradient-to-b from-emerald-100 from-50% to-teal-400 to-50%",
  "bg-gradient-to-b from-fuchsia-100 from-50% to-pink-400 to-50%",
  "bg-gradient-to-b from-cyan-100 from-50% to-indigo-400 to-50%",
  "bg-gradient-to-b from-lime-100 from-50% to-green-400 to-50%",
] as const;

const MISS_RATE_STORAGE_KEY = "ollie-gacha-machine-miss-rate-v1";

function loadMissRatePercent(): number {
  try {
    const stored = window.localStorage.getItem(MISS_RATE_STORAGE_KEY);
    if (stored === null) return DEFAULT_MISS_RATE * 100;
    const parsed = Number(stored);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
  return DEFAULT_MISS_RATE * 100;
}

function saveMissRatePercent(value: number): void {
  try {
    window.localStorage.setItem(MISS_RATE_STORAGE_KEY, String(value));
  } catch {
    // The setting still applies for this session when storage is unavailable.
  }
}

const CAPSULE_POSITIONS = [
  "left-[8%] bottom-[8%] -rotate-12",
  "left-[27%] bottom-[3%] rotate-6",
  "left-[47%] bottom-[9%] -rotate-3",
  "right-[7%] bottom-[5%] rotate-12",
  "left-[15%] bottom-[29%] rotate-12",
  "left-[39%] bottom-[27%] -rotate-6",
  "right-[15%] bottom-[27%] rotate-3",
  "left-[36%] bottom-[48%] rotate-6",
] as const;

const GACHA_STEPS = [
  { number: "1", title: "投入免費代幣", description: "不會扣除任何遊戲金幣" },
  { number: "3", title: "點擊膠囊開獎", description: "結果成功存檔後才會掉出來" },
] as const;

function isKeyboardShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, summary, dialog, [role='button'], [role='link'], [role='textbox'], [contenteditable]",
    ),
  );
}

function getStatusMessage(
  phase: GachaPhase,
  canDraw: boolean,
  isOffline: boolean,
  hasOfflineCache: boolean,
): string {
  if (isOffline) {
    return hasOfflineCache
      ? "目前離線，圖鑑仍可查看；連線後就能繼續扭蛋。"
      : "目前離線，這台裝置尚無可用的圖鑑快取。";
  }
  if (!canDraw && phase === "idle") return "正在確認雲端圖鑑，請稍候。";

  switch (phase) {
    case "idle":
      return "準備好了！先投入免費代幣。";
    case "coinInserted":
      return "代幣投入成功，轉動右側把手吧！";
    case "turning":
      return "扭蛋機轉動中，正在把結果存進雲端…";
    case "capsuleReady":
      return "膠囊掉出來了！點擊膠囊開獎。";
    case "revealed":
      return "本次結果已同步，可以繼續扭蛋。";
  }
}

export default function GachaMachine(props: GachaMachineProps) {
  const auth = useAuth();
  return (
    <GachaMachineSession
      key={auth.user?.uid ?? "signed-out"}
      {...props}
      auth={auth}
    />
  );
}

function GachaMachineSession({ onExit, auth }: GachaMachineSessionProps) {
  const reduceMotion = useReducedMotion();
  const { user, loading: authLoading, authError, signInWithGoogle } = auth;
  const [searchParams, setSearchParams] = useSearchParams();
  const view: GachaView =
    searchParams.get("view") === "collection" ? "collection" : "machine";

  const [save, setSave] = useState<GachaSaveV1>(EMPTY_GACHA_SAVE);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [phase, setPhase] = useState<GachaPhase>("idle");
  const [drawResult, setDrawResult] = useState<GachaDrawResult | null>(null);
  const [hasPendingCapsule, setHasPendingCapsule] = useState(false);
  const [dispensedCapsuleStyleIndex, setDispensedCapsuleStyleIndex] = useState(0);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResettingCollection, setIsResettingCollection] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [missRatePercent, setMissRatePercent] = useState(loadMissRatePercent);
  const phaseRef = useRef<GachaPhase>("idle");
  const saveRef = useRef<GachaSaveV1>(EMPTY_GACHA_SAVE);
  const pendingAttemptRef = useRef<AppliedGachaAttempt | null>(null);
  const bufferedSaveRef = useRef<GachaSaveV1 | null>(null);
  const resetSubmissionStartedRef = useRef(false);
  const drawInFlightRef = useRef(false);
  const drawAttemptTokenRef = useRef(0);
  const loadSequenceRef = useRef(0);
  const loadedUidRef = useRef<string | undefined>(undefined);
  const activeUidRef = useRef(user?.uid);
  const coinButtonRef = useRef<HTMLButtonElement>(null);
  const turnButtonRef = useRef<HTMLButtonElement>(null);
  const capsuleButtonRef = useRef<HTMLButtonElement>(null);
  const collectionTabRef = useRef<HTMLButtonElement>(null);
  const keyboardActionRef = useRef<() => boolean>(() => false);
  activeUidRef.current = user?.uid;

  const setVisibleSave = useCallback((nextSave: GachaSaveV1) => {
    saveRef.current = nextSave;
    setSave(nextSave);
  }, []);

  const setVisibleSaveIfNewer = useCallback((incoming: GachaSaveV1) => {
    if (compareGachaSaveVersions(saveRef.current, incoming) > 0) return;
    saveRef.current = incoming;
    setSave(incoming);
  }, []);

  const clearPendingAttempt = useCallback(() => {
    pendingAttemptRef.current = null;
    bufferedSaveRef.current = null;
    setHasPendingCapsule(false);
  }, []);

  const applyBufferedSave = useCallback(() => {
    const buffered = bufferedSaveRef.current;
    bufferedSaveRef.current = null;
    if (buffered) setVisibleSaveIfNewer(buffered);
  }, [setVisibleSaveIfNewer]);

  const applyIncomingSave = useCallback(
    (incoming: GachaSaveV1) => {
      const current = saveRef.current;
      if (incoming.resetVersion < current.resetVersion) return;

      const pending = pendingAttemptRef.current;
      const protectsActiveDraw =
        drawInFlightRef.current &&
        incoming.resetVersion === current.resetVersion;
      if (
        protectsActiveDraw ||
        (pending && incoming.resetVersion <= pending.save.resetVersion)
      ) {
        const buffered = bufferedSaveRef.current;
        if (
          !buffered ||
          compareGachaSaveVersions(buffered, incoming) <= 0
        ) {
          bufferedSaveRef.current = incoming;
        }
        return;
      }

      if (incoming.resetVersion > current.resetVersion) {
        drawAttemptTokenRef.current += 1;
        drawInFlightRef.current = false;
        clearPendingAttempt();
        setDrawResult(null);
        phaseRef.current = "idle";
        setPhase("idle");
        setActionError(null);
        setActionNotice("圖鑑已在另一個分頁重設，機台狀態已同步更新。");
      }

      setVisibleSaveIfNewer(incoming);
    },
    [clearPendingAttempt, setVisibleSaveIfNewer],
  );

  const applyPendingSave = useCallback((): AppliedGachaAttempt | null => {
    const pending = pendingAttemptRef.current;
    if (!pending) return null;

    const buffered = bufferedSaveRef.current;
    let newest = pending.save;
    if (buffered && compareGachaSaveVersions(newest, buffered) <= 0) {
      newest = buffered;
    }
    setVisibleSaveIfNewer(newest);
    clearPendingAttempt();
    return pending;
  }, [clearPendingAttempt, setVisibleSaveIfNewer]);

  const moveToPhase = (next: GachaPhase): boolean => {
    const current = phaseRef.current;
    if (!canTransitionGachaPhase(current, next)) return false;
    const transitioned = transitionGachaPhase(current, next);
    phaseRef.current = transitioned;
    setPhase(transitioned);
    return true;
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(
    () => () => {
      activeUidRef.current = undefined;
      drawAttemptTokenRef.current += 1;
      loadSequenceRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!user?.uid) {
      loadSequenceRef.current += 1;
      loadedUidRef.current = undefined;
      setVisibleSave(EMPTY_GACHA_SAVE);
      setSyncStatus("loading");
      setSyncError(null);
      setActionError(null);
      setActionNotice(null);
      drawAttemptTokenRef.current += 1;
      drawInFlightRef.current = false;
      phaseRef.current = "idle";
      setPhase("idle");
      setDrawResult(null);
      clearPendingAttempt();
      setIsResetConfirmOpen(false);
      setIsResettingCollection(false);
      setResetError(null);
      resetSubmissionStartedRef.current = false;
      return;
    }

    const uidChanged = loadedUidRef.current !== user.uid;
    if (uidChanged) {
      loadedUidRef.current = user.uid;
      drawAttemptTokenRef.current += 1;
      drawInFlightRef.current = false;
      phaseRef.current = "idle";
      setPhase("idle");
      setDrawResult(null);
      clearPendingAttempt();
      setActionError(null);
      setActionNotice(null);
      setIsResetConfirmOpen(false);
      setIsResettingCollection(false);
      setResetError(null);
      resetSubmissionStartedRef.current = false;
    }

    const sequence = ++loadSequenceRef.current;
    const cached = readGachaCache(user.uid);
    if (uidChanged) {
      setVisibleSave(cached ?? EMPTY_GACHA_SAVE);
    } else if (cached) {
      applyIncomingSave(cached);
    }
    setSyncError(null);

    if (!isOnline) {
      setSyncStatus(cached ? "offline" : "offlineEmpty");
      return;
    }

    setSyncStatus(cached ? "cache" : "loading");
    void loadGachaCloud(user.uid)
      .then((cloudSave) => {
        if (loadSequenceRef.current !== sequence) return;
        applyIncomingSave(cloudSave);
        setSyncStatus("cloud");
      })
      .catch((error: unknown) => {
        if (loadSequenceRef.current !== sequence) return;
        logger.error("Failed to load gacha collection", error);
        setSyncStatus("error");
        setSyncError(
          cached
            ? "無法更新雲端圖鑑，目前顯示上次同步的收藏。"
            : "暫時無法載入雲端圖鑑，請檢查連線後再試。",
        );
      });
  }, [
    applyIncomingSave,
    clearPendingAttempt,
    isOnline,
    setVisibleSave,
    user?.uid,
  ]);

  useEffect(() => {
    if (!user?.uid) return;
    const cacheKey = getGachaCacheKey(user.uid);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== cacheKey || !event.newValue) return;
      const incoming = parseGachaCacheValue(event.newValue);
      if (incoming) applyIncomingSave(incoming);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyIncomingSave, user?.uid]);

  useEffect(() => {
    if (isOnline) return;

    if (phaseRef.current === "coinInserted") {
      const next = transitionGachaPhase(phaseRef.current, "idle");
      phaseRef.current = next;
      setPhase(next);
      setActionError("連線中斷，代幣已退回；重新連線後再試一次。");
    }

    if (isResetConfirmOpen && !resetSubmissionStartedRef.current) {
      setIsResetConfirmOpen(false);
      setResetError(null);
      setActionNotice("連線中斷，尚未送出清空圖鑑；重新連線後可再操作。");
    }
  }, [isOnline, isResetConfirmOpen, isResettingCollection]);

  useEffect(() => {
    if (
      view !== "machine" ||
      phase !== "capsuleReady" ||
      !hasPendingCapsule
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (!document.querySelector("dialog[open]")) {
        capsuleButtonRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasPendingCapsule, phase, view]);

  const setView = (nextView: GachaView) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextView === "collection") {
      nextParams.set("view", "collection");
    } else {
      nextParams.delete("view");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSignIn = () => {
    void signInWithGoogle().catch((error: unknown) => {
      logger.error("Gacha sign-in failed", error);
    });
  };

  const handleInsertCoin = () => {
    if (
      phaseRef.current !== "idle" ||
      !user ||
      !isOnline ||
      syncStatus !== "cloud" ||
      drawInFlightRef.current ||
      isResettingCollection
    ) {
      return;
    }
    setActionError(null);
    setActionNotice(null);
    if (!moveToPhase("coinInserted")) return;
    playSound("click");
    window.requestAnimationFrame(() => turnButtonRef.current?.focus());
  };

  const handleTurn = async () => {
    if (
      phaseRef.current !== "coinInserted" ||
      drawInFlightRef.current ||
      !user ||
      !isOnline
    ) {
      return;
    }

    const uid = user.uid;
    const outcome = pickGachaOutcome(Math.random, missRatePercent / 100);
    const expectedResetVersion = saveRef.current.resetVersion;
    const attemptToken = ++drawAttemptTokenRef.current;
    drawInFlightRef.current = true;
    bufferedSaveRef.current = null;
    setActionError(null);
    setActionNotice(null);
    if (!moveToPhase("turning")) {
      drawInFlightRef.current = false;
      return;
    }
    playSound("click");

    try {
      const committed = await recordGachaAttempt(
        uid,
        outcome,
        expectedResetVersion,
      );
      if (
        activeUidRef.current !== uid ||
        drawAttemptTokenRef.current !== attemptToken
      ) {
        return;
      }
      const phaseAfterCommit = phaseRef.current as GachaPhase;
      if (
        phaseAfterCommit !== "turning" ||
        committed.save.resetVersion !== saveRef.current.resetVersion
      ) {
        if (phaseAfterCommit === "turning") moveToPhase("idle");
        setActionError(
          "圖鑑在抽取完成後被其他分頁重設，本次結果已隨重設清除。請重新投入代幣。",
        );
        return;
      }
      pendingAttemptRef.current = committed;
      setDispensedCapsuleStyleIndex(
        (current) => (current + 1) % DISPENSED_CAPSULE_STYLES.length,
      );
      setHasPendingCapsule(true);
      setSyncStatus(navigator.onLine ? "cloud" : "offline");
      moveToPhase("capsuleReady");
    } catch (error) {
      if (
        activeUidRef.current !== uid ||
        drawAttemptTokenRef.current !== attemptToken
      ) {
        return;
      }
      logger.error("Failed to record gacha draw", error);
      playSound("wrong");
      moveToPhase("idle");
      if (isGachaResetConflictError(error)) {
        try {
          const cloudSave = await loadGachaCloud(uid);
          if (
            activeUidRef.current !== uid ||
            drawAttemptTokenRef.current !== attemptToken
          ) {
            return;
          }
          applyIncomingSave(cloudSave);
          setSyncStatus("cloud");
        } catch (syncFailure) {
          if (
            activeUidRef.current !== uid ||
            drawAttemptTokenRef.current !== attemptToken
          ) {
            return;
          }
          logger.error("Failed to reload gacha after reset conflict", syncFailure);
          setSyncStatus("error");
          setSyncError("圖鑑已重設，但目前無法重新同步；請稍後再試。");
        }
        setActionNotice(null);
        setActionError("圖鑑剛剛已在其他分頁重設，本次沒有開獎。請重新投入代幣。");
      } else {
        setActionError(
          navigator.onLine
            ? "這次開獎沒有寫入雲端，收藏完全不受影響。請再試一次。"
            : "連線中斷，這次沒有開獎；回到線上後再試一次。",
        );
      }
    } finally {
      if (
        activeUidRef.current === uid &&
        drawAttemptTokenRef.current === attemptToken
      ) {
        drawInFlightRef.current = false;
        if (!pendingAttemptRef.current) applyBufferedSave();
      }
    }
  };

  const handleOpenCapsule = () => {
    const pending = pendingAttemptRef.current;
    if (!pending || !moveToPhase("revealed")) return;
    const committed = applyPendingSave();
    if (!committed) return;
    setDrawResult(committed.result);
  };

  const handleCloseReveal = () => {
    if (phaseRef.current === "revealed") moveToPhase("idle");
    setDrawResult(null);
  };

  const handleRetrySync = () => {
    if (!user?.uid || !isOnline) return;
    const sequence = ++loadSequenceRef.current;
    setSyncStatus("loading");
    setSyncError(null);
    void loadGachaCloud(user.uid)
      .then((cloudSave) => {
        if (loadSequenceRef.current !== sequence) return;
        applyIncomingSave(cloudSave);
        setSyncStatus("cloud");
      })
      .catch((error: unknown) => {
        if (loadSequenceRef.current !== sequence) return;
        logger.error("Failed to retry gacha sync", error);
        setSyncStatus("error");
        setSyncError("雲端圖鑑仍然無法連線，請稍後再試。");
      });
  };

  const handleRequestCollectionReset = () => {
    if (!user?.uid || !isOnline || syncStatus !== "cloud") return;
    resetSubmissionStartedRef.current = false;
    setResetError(null);
    setIsResetConfirmOpen(true);
  };

  const handleConfirmCollectionReset = async () => {
    if (
      !user?.uid ||
      !isOnline ||
      syncStatus !== "cloud" ||
      isResettingCollection
    ) {
      return;
    }

    const uid = user.uid;
    resetSubmissionStartedRef.current = true;
    setIsResettingCollection(true);
    setResetError(null);
    try {
      const resetSave = await resetGachaCollection(uid);
      if (activeUidRef.current !== uid) return;
      drawAttemptTokenRef.current += 1;
      drawInFlightRef.current = false;
      clearPendingAttempt();
      setDrawResult(null);
      phaseRef.current = "idle";
      setPhase("idle");
      setVisibleSaveIfNewer(resetSave);
      setSyncStatus("cloud");
      setActionError(null);
      setActionNotice("圖鑑已清空，所有裝置會在下次同步時套用這次重設。");
      resetSubmissionStartedRef.current = false;
      setIsResetConfirmOpen(false);
      window.requestAnimationFrame(() => collectionTabRef.current?.focus());
    } catch (error) {
      logger.error("Failed to reset gacha collection", error);
      setResetError(
        navigator.onLine
          ? "無法清空雲端圖鑑，原有收藏完全沒有變更。請再試一次。"
          : "連線已中斷，原有收藏完全沒有變更。重新連線後再試一次。",
      );
    } finally {
      setIsResettingCollection(false);
    }
  };

  const canDraw =
    isOnline && syncStatus === "cloud" && !isResettingCollection;
  const canResetCollection =
    isOnline &&
    syncStatus === "cloud" &&
    !isResettingCollection;
  const hitRatePercent = 100 - missRatePercent;

  const handleMissRateChange = (value: number) => {
    setMissRatePercent(value);
    saveMissRatePercent(value);
  };

  keyboardActionRef.current = () => {
    if (view !== "machine" || authLoading || !user) return false;

    const current = phaseRef.current;
    if (current === "idle") {
      if (!canDraw) return false;
      handleInsertCoin();
      return true;
    }
    if (current === "coinInserted") {
      if (!isOnline || drawInFlightRef.current) return false;
      void handleTurn();
      return true;
    }
    if (current === "capsuleReady") {
      if (!pendingAttemptRef.current) return false;
      handleOpenCapsule();
      return true;
    }
    return false;
  };

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const isPrimaryKey = event.code === "Space" || event.key === "Enter";
      if (
        !isPrimaryKey ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        document.querySelector("dialog[open]") ||
        isKeyboardShortcutTarget(event.target)
      ) {
        return;
      }

      if (keyboardActionRef.current()) event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, []);

  const unlockedCount = GACHA_CHARACTERS.filter(
    (character) => (save.ownedCounts[character.id] ?? 0) > 0,
  ).length;
  const statusMessage = getStatusMessage(
    phase,
    canDraw,
    !isOnline,
    syncStatus !== "offlineEmpty",
  );
  const syncLabel =
    syncStatus === "cloud"
      ? "已與雲端同步"
      : syncStatus === "cache"
        ? "正在更新雲端圖鑑…"
      : syncStatus === "offline"
          ? "離線快取 · 僅供查看"
          : syncStatus === "offlineEmpty"
            ? "這台裝置沒有離線快取"
          : syncStatus === "error"
            ? "顯示上次同步快取"
            : "正在載入圖鑑…";

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-20 size-96 rounded-full bg-pink-300/15 blur-3xl dark:bg-pink-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 bottom-0 size-[28rem] rounded-full bg-sky-300/15 blur-3xl dark:bg-sky-500/10"
      />

      <header className="relative z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border-hairline bg-background/80 px-3 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-border-hairline bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="返回小遊戲"
            title="返回小遊戲"
          >
            <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground sm:block">
              Ollie Little Games
            </p>
            <h1 className="truncate text-base font-bold tracking-tight sm:text-xl">
              人氣角色扭蛋機
            </h1>
          </div>
        </div>

        <nav
          aria-label="扭蛋機頁面"
          className="flex shrink-0 rounded-[11px] border border-border-hairline bg-muted/70 p-1 shadow-inner"
        >
          <button
            type="button"
            onClick={() => setView("machine")}
            aria-current={view === "machine" ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-4 ${
              view === "machine"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gamepad2 className="size-4" strokeWidth={1.8} aria-hidden="true" />
            <span className="hidden sm:inline">扭蛋機</span>
            <span className="sm:hidden">扭蛋</span>
          </button>
          <button
            ref={collectionTabRef}
            type="button"
            onClick={() => setView("collection")}
            aria-current={view === "collection" ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-4 ${
              view === "collection"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="size-4" strokeWidth={1.8} aria-hidden="true" />
            圖鑑
            {unlockedCount > 0 ? (
              <span className="rounded-full bg-accent-tint px-1.5 py-0.5 text-[10px] font-bold text-accent">
                {unlockedCount}
              </span>
            ) : null}
          </button>
        </nav>
      </header>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {authLoading
          ? "正在準備扭蛋機。"
          : !user
            ? "請先登入以同步角色圖鑑。"
            : actionError ?? actionNotice ?? statusMessage}
      </p>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {authLoading ? (
          <div className="flex min-h-full items-center justify-center p-6" role="status">
            <div className="text-center">
              <span className="loading loading-spinner loading-lg text-accent" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                正在準備扭蛋機…
              </p>
            </div>
          </div>
        ) : !user ? (
          <div className="flex min-h-full items-center justify-center p-5 sm:p-8">
            <section className="glass-panel w-full max-w-md text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-200 to-sky-200 text-4xl shadow-elevated dark:from-pink-500/25 dark:to-sky-500/25">
                <span aria-hidden="true">🎁</span>
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight">
                登入後開始收藏
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                扭蛋圖鑑會安全同步到雲端，換裝置登入也能繼續收藏。
              </p>
              {authError ? (
                <p className="mt-4 rounded-[10px] bg-error/10 px-3 py-2 text-sm text-error" role="alert">
                  {authError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleSignIn}
                className="btn btn-primary mt-6 min-h-11 w-full rounded-[10px]"
              >
                <LogIn className="size-4" strokeWidth={1.8} aria-hidden="true" />
                使用 Google 登入
              </button>
            </section>
          </div>
        ) : view === "collection" ? (
          <div className="px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
            {actionNotice ? (
              <div className="mx-auto mb-4 flex max-w-6xl items-start gap-2 rounded-[12px] border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200" role="status">
                <Check className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                {actionNotice}
              </div>
            ) : null}
            {syncError ? (
              <div className="mx-auto mb-4 flex max-w-6xl flex-col gap-3 rounded-[12px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:text-amber-200" role="alert">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {syncError}
                </span>
                {isOnline ? (
                  <button
                    type="button"
                    onClick={handleRetrySync}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-background/80 px-3 font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <RefreshCw className="size-4" strokeWidth={1.8} aria-hidden="true" />
                    重新同步
                  </button>
                ) : null}
              </div>
            ) : null}
            {syncStatus === "offlineEmpty" ? (
              <section className="mx-auto flex min-h-[55dvh] w-full max-w-xl items-center justify-center text-center">
                <div className="rounded-[18px] border border-amber-400/30 bg-card p-6 shadow-sm sm:p-8">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-400/10 text-amber-700 dark:text-amber-300">
                    <WifiOff className="size-7" strokeWidth={1.7} aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 text-xl font-bold tracking-tight">
                    這台裝置還沒有離線圖鑑
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    先連上網路完成一次同步，之後離線時就能查看最後成功同步的收藏。
                  </p>
                </div>
              </section>
            ) : (
              <GachaCollection
                save={save}
                isLoading={syncStatus === "loading" || syncStatus === "cache"}
                isOffline={!isOnline}
                syncLabel={syncLabel}
                hasPendingCapsule={hasPendingCapsule}
                canResetCollection={canResetCollection}
                onOpenPendingCapsule={() => setView("machine")}
                onRequestReset={handleRequestCollectionReset}
              />
            )}
          </div>
        ) : (
          <div className="mx-auto grid min-h-full w-full max-w-6xl items-center gap-5 px-3 py-5 sm:px-6 sm:py-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:gap-8 lg:px-8">
            <section aria-label="扭蛋機" className="min-w-0">
              {!isOnline && (
                <div className="mb-3 flex justify-end px-1">
                  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <WifiOff className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                    離線模式
                  </span>
                </div>
              )}

              <motion.div
                animate={
                  phase === "turning" && !reduceMotion
                    ? {
                        x: [0, -5, 5, -4, 4, -2, 2, 0],
                        rotate: [0, -0.8, 0.8, -0.5, 0.5, 0],
                      }
                    : { x: 0, rotate: 0 }
                }
                transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeInOut" }}
                className="relative mx-auto w-full max-w-[570px] select-none"
              >
                <div className="relative z-20 mx-auto h-6 w-[72%] rounded-t-[32px] border border-white/60 bg-gradient-to-b from-pink-300 to-pink-500 shadow-[inset_0_2px_0_rgba(255,255,255,0.55),0_8px_20px_rgba(190,68,119,0.18)] dark:border-white/15 dark:from-pink-500 dark:to-pink-700" />

                <div className="relative z-10 mx-auto -mt-1 aspect-[1.22/1] w-[76%] overflow-hidden rounded-t-[42%] border-[6px] border-pink-400/75 bg-white/35 shadow-[inset_0_0_45px_rgba(255,255,255,0.65),0_16px_30px_rgba(68,50,88,0.12)] backdrop-blur-[2px] dark:border-pink-600/70 dark:bg-white/10 dark:shadow-[inset_0_0_35px_rgba(255,255,255,0.08),0_16px_30px_rgba(0,0,0,0.22)]">
                  <div aria-hidden="true" className="absolute left-[18%] top-[8%] h-[48%] w-[13%] -rotate-[24deg] rounded-full bg-white/55 blur-sm dark:bg-white/10" />
                  <div aria-hidden="true" className="absolute right-[10%] top-[12%] size-3 rounded-full bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.85)] dark:bg-white/30" />
                  {CAPSULE_STYLES.map((capsuleStyle, index) => (
                    <motion.div
                      key={capsuleStyle}
                      aria-hidden="true"
                      animate={
                        phase === "turning" && !reduceMotion
                          ? { y: [0, -12, 5, -7, 0], rotate: [0, 12, -8, 0] }
                          : { y: 0, rotate: 0 }
                      }
                      transition={{
                        duration: reduceMotion ? 0 : 0.62,
                        delay: reduceMotion ? 0 : index * 0.025,
                      }}
                      className={`absolute size-[26%] overflow-hidden rounded-full border-2 border-white/80 shadow-[0_8px_14px_rgba(65,45,84,0.22),inset_0_2px_0_rgba(255,255,255,0.7)] ${CAPSULE_POSITIONS[index]} ${capsuleStyle}`}
                    >
                      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/80 shadow-sm" />
                      <span className="absolute left-[24%] top-[14%] h-[27%] w-[13%] -rotate-[28deg] rounded-full bg-white/65 blur-[1px]" />
                    </motion.div>
                  ))}
                  <div className="absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-t from-pink-200/90 to-transparent dark:from-pink-900/60" />
                </div>

                <div className="relative z-20 mx-auto -mt-2 w-[88%] rounded-b-[28px] rounded-t-[18px] border border-pink-500/35 bg-gradient-to-b from-pink-400 via-pink-500 to-rose-500 px-5 pb-5 pt-6 shadow-[inset_0_2px_0_rgba(255,255,255,0.38),0_22px_45px_rgba(161,50,96,0.22)] dark:from-pink-600 dark:via-pink-700 dark:to-rose-800">
                  <div className="grid grid-cols-[1fr_112px] items-center gap-4 sm:grid-cols-[1fr_132px] sm:gap-6">
                    <div className="relative flex min-h-32 flex-col items-center justify-center rounded-[18px] border border-white/45 bg-white/88 px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_18px_rgba(103,42,73,0.16)] dark:border-white/10 dark:bg-slate-900/80">
                      <div className="relative mb-2 flex h-12 w-20 items-center justify-center rounded-[10px] border border-slate-300 bg-slate-800 shadow-inner dark:border-slate-600">
                        <div className="h-8 w-2 rounded-full bg-black shadow-[inset_0_0_4px_rgba(255,255,255,0.25)]" />
                        <AnimatePresence>
                          {phase === "coinInserted" ? (
                            <motion.div
                              initial={reduceMotion ? false : { y: -35, opacity: 0, rotateY: 0 }}
                              animate={{ y: 8, opacity: 1, rotateY: reduceMotion ? 0 : 360 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeIn" }}
                              className="absolute -top-4 flex size-8 items-center justify-center rounded-full border-2 border-amber-300 bg-gradient-to-br from-yellow-200 to-amber-500 text-[10px] font-black text-amber-900 shadow-md"
                            >
                              O
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                      <button
                        ref={coinButtonRef}
                        type="button"
                        onClick={handleInsertCoin}
                        disabled={phase !== "idle" || !canDraw}
                        aria-keyshortcuts="Space Enter"
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-b from-amber-300 to-amber-500 px-3 text-sm font-black text-amber-950 shadow-[0_4px_0_rgb(180,83,9),0_8px_15px_rgba(146,64,14,0.2)] transition-all hover:brightness-105 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pink-500"
                      >
                        <CircleDollarSign className="size-4" strokeWidth={2} aria-hidden="true" />
                        {syncStatus === "loading" || syncStatus === "cache"
                          ? "同步中…"
                          : "投入免費代幣"}
                      </button>
                    </div>

                    <button
                      ref={turnButtonRef}
                      type="button"
                      onClick={() => void handleTurn()}
                      disabled={phase !== "coinInserted"}
                      aria-keyshortcuts="Space Enter"
                      aria-label={
                        phase === "coinInserted"
                          ? "轉動扭蛋機把手"
                          : "請先投入代幣"
                      }
                      className="group relative mx-auto flex size-28 items-center justify-center rounded-full border-[6px] border-pink-200/90 bg-gradient-to-br from-white to-pink-100 shadow-[0_8px_0_rgb(190,65,113),0_15px_24px_rgba(111,39,73,0.22),inset_0_2px_0_rgba(255,255,255,0.8)] transition-all hover:brightness-105 active:translate-y-1 active:shadow-[0_3px_0_rgb(190,65,113)] disabled:cursor-not-allowed disabled:grayscale disabled:opacity-55 dark:border-pink-400/30 dark:from-slate-700 dark:to-slate-800 sm:size-32"
                    >
                      <motion.span
                        animate={{
                          rotate:
                            phase === "turning" && !reduceMotion
                              ? 360
                              : phase === "coinInserted"
                                ? 12
                                : 0,
                        }}
                        transition={{
                          duration: reduceMotion ? 0 : phase === "turning" ? 0.65 : 0.2,
                          ease: "easeInOut",
                        }}
                        className="flex size-[70%] items-center justify-center rounded-full border-4 border-slate-300 bg-gradient-to-br from-slate-100 to-slate-300 text-pink-600 shadow-inner dark:border-slate-500 dark:from-slate-600 dark:to-slate-800 dark:text-pink-300"
                      >
                        <RotateCw className="size-10 sm:size-12" strokeWidth={2.4} aria-hidden="true" />
                      </motion.span>
                    </button>
                  </div>

                  <div className="relative mx-auto mt-5 flex h-24 w-[78%] items-center justify-center overflow-hidden rounded-b-[18px] rounded-t-[8px] border-4 border-rose-900/45 bg-gradient-to-b from-rose-950 to-slate-950 shadow-[inset_0_10px_18px_rgba(0,0,0,0.65),0_2px_0_rgba(255,255,255,0.25)]">
                    <div className="absolute inset-x-3 top-3 h-1 rounded-full bg-white/10" />
                    <AnimatePresence>
                      {phase === "capsuleReady" && hasPendingCapsule ? (
                        <motion.button
                          ref={capsuleButtonRef}
                          type="button"
                          onClick={handleOpenCapsule}
                          aria-keyshortcuts="Space Enter"
                          initial={reduceMotion ? false : { y: -125, rotate: -24, scale: 0.78 }}
                          animate={{ y: 0, rotate: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.58,
                            type: reduceMotion ? "tween" : "spring",
                            bounce: reduceMotion ? 0 : 0.42,
                          }}
                          data-capsule-variant={dispensedCapsuleStyleIndex}
                          className={`relative flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 shadow-[0_8px_16px_rgba(0,0,0,0.45),inset_0_2px_0_rgba(255,255,255,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${DISPENSED_CAPSULE_STYLES[dispensedCapsuleStyleIndex]}`}
                          aria-label="膠囊已經出來，點擊開獎"
                        >
                          <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/90 shadow-sm" />
                          <span aria-hidden="true" className="absolute left-4 top-3 h-5 w-2 -rotate-[28deg] rounded-full bg-white/70 blur-[1px]" />
                          {!reduceMotion ? (
                            <span aria-hidden="true" className="absolute -right-0.5 top-0 text-base text-amber-300">
                              ✦
                            </span>
                          ) : null}
                        </motion.button>
                      ) : phase === "turning" ? (
                        <motion.div
                          key="dispensing"
                          className="flex items-center gap-2 text-xs font-semibold text-white/65"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <span className="loading loading-dots loading-sm" />
                          雲端存檔中
                        </motion.div>
                      ) : (
                        <div className="h-3 w-28 rounded-full bg-black/50 shadow-inner" aria-hidden="true" />
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mx-auto flex w-[78%] justify-between px-2">
                  <div className="h-4 w-16 rounded-b-[9px] bg-rose-700 shadow-md dark:bg-rose-900" />
                  <div className="h-4 w-16 rounded-b-[9px] bg-rose-700 shadow-md dark:bg-rose-900" />
                </div>
              </motion.div>

              <div className="mx-auto mt-4 flex min-h-12 max-w-[570px] items-center justify-center gap-2 rounded-[12px] border border-border-hairline bg-card px-4 py-2 text-center text-sm font-semibold shadow-sm">
                {phase === "capsuleReady" ? (
                  <Sparkles className="size-4 shrink-0 text-amber-500" strokeWidth={1.8} aria-hidden="true" />
                ) : phase === "turning" ? (
                  <span className="loading loading-spinner loading-sm shrink-0 text-accent" />
                ) : (
                  <Ticket className="size-4 shrink-0 text-pink-500" strokeWidth={1.8} aria-hidden="true" />
                )}
                {statusMessage}
              </div>

              {actionError ? (
                <div className="mx-auto mt-3 flex max-w-[570px] flex-col gap-3 rounded-[12px] border border-error/25 bg-error/10 px-4 py-3 text-sm text-error sm:flex-row sm:items-center sm:justify-between" role="alert">
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                    {actionError}
                  </span>
                  <button
                    type="button"
                    onClick={handleInsertCoin}
                    disabled={!canDraw}
                    className="min-h-11 shrink-0 rounded-[8px] bg-background/80 px-3 font-semibold text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    重新投入代幣
                  </button>
                </div>
              ) : null}

              {actionNotice ? (
                <div className="mx-auto mt-3 flex max-w-[570px] items-start gap-2 rounded-[12px] border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200" role="status">
                  <Check className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                  {actionNotice}
                </div>
              ) : null}
            </section>

            <aside className="space-y-4 lg:sticky lg:top-5" aria-label="扭蛋說明與收藏進度">
              <section className="rounded-[18px] border border-border-hairline bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-2">
                    <SlidersHorizontal className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.8} aria-hidden="true" />
                    <div>
                      <h2 className="text-base font-bold tracking-tight">空膠囊機率</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        儲存在這台裝置，下一次轉動把手時套用。
                      </p>
                    </div>
                  </div>
                  <output
                    htmlFor="gacha-miss-rate"
                    className="shrink-0 rounded-full bg-accent-tint px-2.5 py-1 text-sm font-black tabular-nums text-accent"
                  >
                    {missRatePercent}%
                  </output>
                </div>
                <input
                  id="gacha-miss-rate"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={missRatePercent}
                  onChange={(event) => handleMissRateChange(Number(event.target.value))}
                  className="range range-primary mt-4 w-full"
                  aria-label="空膠囊機率"
                  aria-valuetext={`${missRatePercent}%`}
                />
                <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
                  <span>0%（必得角色）</span>
                  <span>100%（必定為空）</span>
                </div>
              </section>

              <section className="rounded-[18px] border border-border-hairline bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Info className="size-5 text-accent" strokeWidth={1.8} aria-hidden="true" />
                  <h2 className="text-lg font-bold tracking-tight">怎麼玩</h2>
                </div>
                <ol className="mt-4 space-y-3">
                  {[
                    GACHA_STEPS[0],
                    {
                      number: "2",
                      title: "轉動機台把手",
                      description: `${hitRatePercent}% 命中角色、${missRatePercent}% 空膠囊`,
                    },
                    GACHA_STEPS[1],
                  ].map(({ number, title, description }, index) => {
                    const completed =
                      (index === 0 && phase !== "idle") ||
                      (index === 1 && ["turning", "capsuleReady", "revealed"].includes(phase)) ||
                      (index === 2 && phase === "revealed");
                    const active =
                      (index === 0 && phase === "idle") ||
                      (index === 1 && phase === "coinInserted") ||
                      (index === 2 && phase === "capsuleReady");
                    return (
                      <li key={number} className="flex items-start gap-3">
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                            completed
                              ? "bg-emerald-500 text-white"
                              : active
                                ? "bg-accent text-white shadow-sm"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {completed ? (
                            <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
                          ) : (
                            number
                          )}
                        </span>
                        <span className="min-w-0 pt-0.5">
                          <strong className="block text-sm font-bold text-foreground">
                            {title}
                          </strong>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            {description}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-5 border-t border-border-hairline pt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    鍵盤快速操作
                  </p>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    按
                    <kbd className="mx-1 rounded-[5px] border border-border-hairline bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground shadow-sm">
                      空白鍵
                    </kbd>
                    或
                    <kbd className="mx-1 rounded-[5px] border border-border-hairline bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground shadow-sm">
                      Enter
                    </kbd>
                    ，即可依序投幣、轉動與開啟膠囊。
                  </p>
                </div>
              </section>

              <section className="rounded-[18px] border border-border-hairline bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">圖鑑進度</p>
                    <p className="mt-1 text-2xl font-black tracking-tight">
                      {unlockedCount}
                      <span className="ml-1 text-sm font-semibold text-muted-foreground">
                        / {GACHA_CHARACTERS.length}
                      </span>
                    </p>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-[14px] bg-accent-tint text-accent">
                    <BookOpen className="size-6" strokeWidth={1.7} aria-hidden="true" />
                  </div>
                </div>
                <progress
                  className="progress progress-primary mt-4 h-2 w-full"
                  value={unlockedCount}
                  max={GACHA_CHARACTERS.length}
                  aria-label="角色圖鑑收集進度"
                />
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>累計扭蛋 {save.totalDraws} 次</span>
                  <span className="inline-flex items-center gap-1">
                    {syncStatus === "cloud" ? (
                      <Cloud className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                    ) : (
                      <RefreshCw className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                    )}
                    {syncLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setView("collection")}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[9px] border border-border-hairline bg-background px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <BookOpen className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  查看完整圖鑑
                </button>
              </section>

              {!isOnline || syncError ? (
                <div className="rounded-[14px] border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-800 dark:text-amber-200" role="alert">
                  <div className="flex items-start gap-2">
                    {!isOnline ? (
                      <WifiOff className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                    )}
                    <p>
                      {!isOnline
                        ? syncStatus === "offlineEmpty"
                          ? "目前離線，而且這台裝置還沒有可查看的圖鑑快取。"
                          : "離線時可以查看快取圖鑑，但不能進行扭蛋。"
                        : syncError}
                    </p>
                  </div>
                  {isOnline && syncError ? (
                    <button
                      type="button"
                      onClick={handleRetrySync}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-background/80 px-3 font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <RefreshCw className="size-4" strokeWidth={1.8} aria-hidden="true" />
                      重新同步
                    </button>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </main>

      <GachaRevealDialog
        isOpen={phase === "revealed"}
        result={drawResult}
        reduceMotion={Boolean(reduceMotion)}
        onClose={handleCloseReveal}
        onOpenCollection={() => setView("collection")}
        onRestoreFocus={() => {
          const collectionTab = collectionTabRef.current;
          if (collectionTab?.getAttribute("aria-current") === "page") {
            collectionTab.focus();
          } else {
            coinButtonRef.current?.focus();
          }
        }}
      />
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="清空整本圖鑑？"
        message={`這會移除全部 ${GACHA_CHARACTERS.length} 個圖鑑項目、相遇次數、抽取與空膠囊統計，並同步到其他裝置。這個動作無法復原。`}
        confirmText="清空圖鑑"
        cancelText="保留收藏"
        confirmVariant="error"
        isLoading={isResettingCollection}
        confirmDisabled={!isOnline}
        errorMessage={resetError}
        onConfirm={() => void handleConfirmCollectionReset()}
        onCancel={() => {
          if (isResettingCollection) return;
          resetSubmissionStartedRef.current = false;
          setIsResetConfirmOpen(false);
          setResetError(null);
        }}
      />
    </div>
  );
}
