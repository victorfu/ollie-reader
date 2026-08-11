import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CircleDollarSign,
  Cloud,
  Expand,
  Heart,
  LogIn,
  Maximize2,
  RefreshCw,
  Settings,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useSettings } from "../../../hooks/useSettings";
import { useSpeechState } from "../../../hooks/useSpeechState";
import { useToastQueue } from "../../../hooks/useToastQueue";
import { ToastContainer } from "../../common/ToastContainer";
import { todayLocal } from "../../../services/economyService";
import { logger } from "../../../utils/logger";
import { openGameTab } from "../../../utils/gameTabs";
import { DAILY_BOND_CAP } from "./constants";
import { FREE_FOODS, SNACKS } from "./data/foods";
import { getPhrase, getUnlockedPhrases } from "./data/phrases";
import { getToy } from "./data/toys";
import { getWishDefinition } from "./logic/wish";
import { refreshDailyWish } from "./logic/wish";
import {
  getBondProgress,
  getNewBondUnlocks,
  getUnlockedContent,
} from "./logic/bond";
import {
  applyCareActionWithWish,
  comparePetSaveFreshness,
  createInitialPetSave,
  deriveStats,
  isSleeping,
  preparePetVisit,
  restockFreeFood,
  touchPetSave,
  wakePet,
  type CareActionResult,
} from "./logic/petState";
import { applyPurchase, getProduct } from "./logic/purchases";
import {
  applyPersonalizationAction,
  type BondGift,
  type PersonalizationAction,
} from "./logic/personalization";
import type {
  BondUnlock,
  CottageProductId,
  FoodId,
  PetSaveV1,
  SnackId,
  ToyId,
  WishAction,
} from "./types";
import {
  CottageAlreadyOwnedError,
  CottageInsufficientCoinsError,
  commitCottageCareAction,
  commitCottagePersonalizationActions,
  compareCottageSaveVersions,
  getCottageCacheKey,
  loadCottageCloud,
  loadCottageCoins,
  parseCottageCacheValue,
  purchaseCottageProduct,
  readCottageCache,
  saveCottageCloud,
  writeCottageCache,
} from "./storage";
import {
  playBubbleSound,
  playEatSound,
  playHeartSound,
  playLullabySound,
  playSelectSound,
  playToySound,
} from "./audio";
import { useAudioSettings } from "./useAudioSettings";
import {
  CottageScene,
  type CottageSceneAction,
  type CottageSpeechBubble,
  type CottageTimeOfDay,
} from "./ui/CottageScene";
import { CottageStatusBar } from "./ui/CottageStatusBar";
import { CottagePanel } from "./ui/CottagePanel";
import {
  CottageToolbar,
  type CottageToolbarAction,
} from "./ui/CottageToolbar";
import {
  CottageShopPanel,
  type CottageShopCategory,
} from "./ui/CottageShopPanel";
import { Wardrobe } from "./ui/Wardrobe";
import { RoomEditor } from "./ui/RoomEditor";

interface CloudCottageProps {
  onExit: () => void;
}

type PanelId = "food" | "bath" | "toys" | "shop" | "actions" | "settings" | null;
type PersonalizationMode = "decorate" | "wardrobe" | null;
type PersonalizationPreview =
  | { mode: "decorate"; room: PetSaveV1["room"] }
  | { mode: "wardrobe"; equipped: PetSaveV1["equipped"] }
  | null;
type SyncStatus = "loading" | "cache" | "cloud" | "offline" | "error" | "demo";

const FOOD_EMOJI: Record<FoodId, string> = {
  milk: "🥛",
  cookie: "🍪",
  apple: "🍎",
  "banana-yogurt": "🍌",
  pudding: "🍮",
  "honey-toast": "🍞",
  "strawberry-pancake": "🥞",
  "cinnamon-roll": "🥐",
  "rainbow-donut": "🍩",
  "cloud-cake": "🍰",
};

const TOY_EMOJI: Record<ToyId, string> = {
  ball: "⚽",
  frisbee: "🥏",
  "bubble-machine": "🫧",
  "music-box": "🎶",
  "cloud-swing": "☁️",
};

const TOY_SCENES: Record<ToyId, CottageSceneAction> = {
  ball: "playBall",
  frisbee: "playFrisbee",
  "bubble-machine": "playBubbles",
  "music-box": "playMusicBox",
  "cloud-swing": "playSwing",
};

const TOY_PHRASES: Record<ToyId, string> = {
  ball: "play-ball",
  frisbee: "play-frisbee",
  "bubble-machine": "play-bubbles",
  "music-box": "play-music-box",
  "cloud-swing": "play-cloud-swing",
};

const ACTION_SCENES: Record<string, CottageSceneAction> = {
  spin: "spin",
  "happy-dance": "dance",
  "roll-over": "roll",
  "ear-flight": "fly",
  "cloud-bounce": "cloudBounce",
  "family-celebration": "celebrate",
};

const ACTION_EMOJI: Record<string, string> = {
  spin: "🌀",
  "happy-dance": "🎵",
  "roll-over": "💕",
  "ear-flight": "☁️",
  "cloud-bounce": "⭐",
  "family-celebration": "🎉",
};

const DEMO_UID = "cloud-cottage-demo";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (milliseconds: number) => void | Promise<void>;
  }
}

function isKeyboardShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable]",
    ),
  );
}

function timeOfDayAt(now: number): CottageTimeOfDay {
  const hour = new Date(now).getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function speechForPhrase(id: string): CottageSpeechBubble {
  const phrase = getPhrase(id);
  if (!phrase) throw new Error(`Missing Cloud Cottage phrase: ${id}`);
  return { en: phrase.en, zh: phrase.zh };
}

function greetingFor(now: number, sleeping: boolean): CottageSpeechBubble {
  if (sleeping) return speechForPhrase("sleepy");
  const period = timeOfDayAt(now);
  if (period === "morning") return speechForPhrase("good-morning");
  if (period === "day") return speechForPhrase("good-afternoon");
  return speechForPhrase("good-evening");
}

function careFailureMessage(result: CareActionResult): CottageSpeechBubble {
  switch (result.reason) {
    case "full":
      return speechForPhrase("full");
    case "out-of-stock":
      return speechForPhrase("all-gone");
    case "toy-not-owned":
      return speechForPhrase("find-a-toy");
    case "outside-sleep-window":
      return speechForPhrase("playtime");
    case "already-slept":
      return speechForPhrase("slept-well");
    default:
      return speechForPhrase("happy");
  }
}

function syncLabel(status: SyncStatus): string {
  switch (status) {
    case "cloud":
      return "已存入雲端";
    case "cache":
      return "正在同步";
    case "offline":
      return "離線遊玩";
    case "demo":
      return "體驗模式";
    case "error":
      return "同步失敗";
    default:
      return "準備中";
  }
}

function unlocksForGifts(
  gifts: readonly BondGift[],
  bondTotal: number,
): BondUnlock[] {
  if (gifts.length === 0) return [];
  const giftIds = new Set<string>(gifts.map((gift) => gift.id));
  return getUnlockedContent(getBondProgress(bondTotal).level, 2).filter(
    (unlock) => unlock.type === "gift" && giftIds.has(unlock.id),
  );
}

export default function CloudCottage({ onExit }: CloudCottageProps) {
  const auth = useAuth();
  const { loading: settingsLoading } = useSettings();
  const { speakAsync, stopSpeaking } = useSpeechState();
  const audio = useAudioSettings();
  const reducedMotion = Boolean(useReducedMotion());
  const { toasts, addToast, removeToast } = useToastQueue();
  const rootRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<PetSaveV1>(createInitialPetSave());
  const nowRef = useRef(Date.now());
  const timeOffsetRef = useRef(0);
  const loadSequenceRef = useRef(0);
  const loadedUidRef = useRef<string | undefined>(undefined);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSpeechRef = useRef<string | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bathPointerRef = useRef<{ x: number; y: number } | null>(null);
  const bathStrokeDistanceRef = useRef(0);
  const bathStrokeHandledRef = useRef(false);
  const pendingCloudWriteRef = useRef(false);
  const deferredToastAtRef = useRef(0);
  const cloudQueueRef = useRef<Promise<void>>(Promise.resolve());
  const personalizationPreviewRef = useRef<PersonalizationPreview>(null);

  const isDemo = import.meta.env.DEV
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("demo") === "1";
  const uid = isDemo ? DEMO_UID : auth.user?.uid;

  const [save, setSave] = useState<PetSaveV1>(() => createInitialPetSave());
  const [now, setNow] = useState(() => Date.now());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [coinBalance, setCoinBalance] = useState<number | null>(isDemo ? 500 : null);
  const [coinError, setCoinError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelId>(null);
  const [personalizationMode, setPersonalizationMode] =
    useState<PersonalizationMode>(null);
  const [sceneAction, setSceneAction] = useState<CottageSceneAction>("idle");
  const [sceneActionKey, setSceneActionKey] = useState(0);
  const [actionEmoji, setActionEmoji] = useState<string | undefined>(undefined);
  const [speech, setSpeech] = useState<CottageSpeechBubble | null>(null);
  const [bathRubCount, setBathRubCount] = useState(0);
  const [purchasingId, setPurchasingId] = useState<CottageProductId | null>(null);
  const [personalizationBusy, setPersonalizationBusy] = useState(false);
  const [shopKind, setShopKind] = useState<CottageShopCategory>("snack");
  const [insufficientProductId, setInsufficientProductId] = useState<CottageProductId | null>(null);
  const [unlocks, setUnlocks] = useState<BondUnlock[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  nowRef.current = now;
  saveRef.current = save;

  const setVisibleSave = useCallback((next: PetSaveV1) => {
    saveRef.current = next;
    setSave(next);
  }, []);

  const setVisibleSaveIfNewer = useCallback((incoming: PetSaveV1) => {
    if (comparePetSaveFreshness(incoming, saveRef.current) < 0) return;
    saveRef.current = incoming;
    setSave(incoming);
  }, []);

  const handleRoomPreviewChange = useCallback(
    (room: PetSaveV1["room"] | null) => {
      personalizationPreviewRef.current = room
        ? { mode: "decorate", room }
        : null;
    },
    [],
  );

  const handleWardrobePreviewChange = useCallback(
    (equipped: PetSaveV1["equipped"] | null) => {
      personalizationPreviewRef.current = equipped
        ? { mode: "wardrobe", equipped }
        : null;
    },
    [],
  );

  const showSpeech = useCallback(
    (next: CottageSpeechBubble, speak = true) => {
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      setSpeech(next);
      speechTimerRef.current = setTimeout(() => {
        setSpeech(null);
        if (pendingSpeechRef.current === next.en) pendingSpeechRef.current = null;
      }, 4_200);
      if (
        speak
        && audio.settings.speechEnabled
        && next.en.trim()
      ) {
        if (settingsLoading) {
          pendingSpeechRef.current = next.en;
        } else {
          pendingSpeechRef.current = null;
          void speakAsync(next.en).catch((error: unknown) => {
            logger.warn("Cloud Cottage TTS unavailable", error);
          });
        }
      } else {
        pendingSpeechRef.current = null;
      }
    },
    [audio.settings.speechEnabled, settingsLoading, speakAsync],
  );
  const showSpeechRef = useRef(showSpeech);
  useEffect(() => {
    showSpeechRef.current = showSpeech;
  }, [showSpeech]);

  useEffect(() => {
    if (settingsLoading) return;
    const pendingSpeech = pendingSpeechRef.current;
    pendingSpeechRef.current = null;
    if (!pendingSpeech || !audio.settings.speechEnabled) return;
    void speakAsync(pendingSpeech).catch((error: unknown) => {
      logger.warn("Cloud Cottage queued TTS unavailable", error);
    });
  }, [audio.settings.speechEnabled, settingsLoading, speakAsync]);

  const showPhrase = useCallback(
    (phraseId: string | undefined, fallback: CottageSpeechBubble) => {
      const level = getBondProgress(saveRef.current.bond.total).level;
      let phrase = phraseId ? getPhrase(phraseId) : undefined;
      if (phrase && phrase.unlockLevel > level) phrase = undefined;

      if (phraseId === "good-night") {
        const sweetDreams = getPhrase("sweet-dreams");
        if (sweetDreams && sweetDreams.unlockLevel <= level) phrase = sweetDreams;
      } else if (!phraseId) {
        const bondPhrases = getUnlockedPhrases(level).filter(
          (candidate) => candidate.context === "bond",
        );
        if (bondPhrases.length > 0) {
          phrase = bondPhrases[saveRef.current.revision % bondPhrases.length];
        }
      }
      showSpeech(phrase ? { en: phrase.en, zh: phrase.zh } : fallback);
    },
    [showSpeech],
  );

  const triggerAction = useCallback(
    (action: CottageSceneAction, emoji?: string, persist = false) => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      setActionEmoji(emoji);
      setSceneAction(action);
      setSceneActionKey((key) => key + 1);
      if (!persist && action !== "sleep") {
        const duration = action === "fly"
          ? 2_250
          : action === "bath" || action === "celebrate"
            ? 2_650
            : action === "heartBurst"
              ? 2_200
            : action === "nap"
              ? 6_000
              : action.startsWith("play")
                ? 1_900
                : 1_450;
        actionTimerRef.current = setTimeout(() => {
          setActionEmoji(undefined);
          setSceneAction("idle");
          setSceneActionKey((key) => key + 1);
        }, duration);
      }
    },
    [],
  );

  const queueCloudSave = useCallback(
    (next: PetSaveV1) => {
      if (!uid || isDemo) return;
      pendingCloudWriteRef.current = true;
      cloudQueueRef.current = cloudQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (!navigator.onLine) throw new Error("offline");
          const committed = await saveCottageCloud(uid, next);
          setVisibleSaveIfNewer(committed);
          pendingCloudWriteRef.current = false;
          setSyncStatus("cloud");
          setSyncError(null);
        })
        .catch((error: unknown) => {
          pendingCloudWriteRef.current = true;
          setSyncStatus("offline");
          setSyncError("離線中，照顧紀錄已留在這台裝置，連線後會再同步。");
          if (Date.now() - deferredToastAtRef.current > 8_000) {
            deferredToastAtRef.current = Date.now();
            addToast("離線中，這次照顧已安全留在裝置上。", "info");
          }
          logger.warn("Cloud Cottage care save deferred", error);
        });
    },
    [addToast, isDemo, setVisibleSaveIfNewer, uid],
  );

  const commitLocalSave = useCallback(
    (next: PetSaveV1, sync = true) => {
      setVisibleSave(next);
      if (uid) void writeCottageCache(uid, next);
      if (sync) queueCloudSave(next);
    },
    [queueCloudSave, setVisibleSave, uid],
  );

  const refreshCoins = useCallback(
    async (activeUid: string) => {
      if (isDemo) {
        setCoinBalance((current) => current ?? 500);
        return;
      }
      try {
        const coins = await loadCottageCoins(activeUid);
        setCoinBalance(coins);
        setCoinError(null);
      } catch (error) {
        logger.error("Failed to load Cloud Cottage coin balance", error);
        setCoinBalance(null);
        setCoinError("暫時讀不到扭蛋代幣，請稍後重試。");
      }
    },
    [isDemo],
  );

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = Date.now() + timeOffsetRef.current;
      nowRef.current = next;
      setNow(next);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const sequence = ++loadSequenceRef.current;
    const identityChanged = loadedUidRef.current !== uid;
    loadedUidRef.current = uid;
    if (identityChanged) {
      setPanel(null);
      setPersonalizationMode(null);
      setInsufficientProductId(null);
    }
    if (!uid) {
      setSyncStatus("loading");
      setCoinBalance(null);
      setSyncError(null);
      return;
    }

    const loadNow = nowRef.current;
    if (isDemo) {
      let initial = createInitialPetSave(loadNow);
      initial = {
        ...initial,
        wish: refreshDailyWish(
          initial.wish,
          uid,
          todayLocal(new Date(loadNow)),
          initial.inventory.toys,
        ),
      };
      setVisibleSave(initial);
      setSyncStatus("demo");
      setCoinBalance(500);
      triggerAction("intro");
      showSpeechRef.current(greetingFor(loadNow, false));
      return;
    }

    const persistedCache = readCottageCache(uid, undefined, loadNow);
    // Connectivity changes should rehydrate from disk when possible, but a
    // restricted/failed localStorage must not discard the already-visible save
    // (or unmount an editor containing an unsaved draft). Never carry this
    // fallback across an actual account change.
    const cached = persistedCache ?? (identityChanged ? null : saveRef.current);
    if (cached) {
      setVisibleSave(cached);
      setSyncStatus(isOnline ? "cache" : "offline");
    } else {
      setSyncStatus(isOnline ? "loading" : "error");
    }

    const finishLoad = async (loaded: PetSaveV1, firstVisit: boolean) => {
      if (loadSequenceRef.current !== sequence) return;
      const prepared = preparePetVisit(loaded, uid, loadNow);
      setVisibleSave(prepared.save);
      await writeCottageCache(uid, prepared.save);
      if (isOnline) {
        try {
          const committed = await saveCottageCloud(uid, prepared.save);
          if (loadSequenceRef.current !== sequence) return;
          setVisibleSaveIfNewer(committed);
          setSyncStatus("cloud");
          setSyncError(null);
        } catch (error) {
          pendingCloudWriteRef.current = true;
          setSyncStatus("offline");
          setSyncError("離線中，稍後會自動同步。");
          logger.warn("Cloud Cottage visit save deferred", error);
        }
      }
      if (prepared.missed) {
        triggerAction("missed");
        showSpeechRef.current(speechForPhrase("missed-you"));
      } else {
        triggerAction(firstVisit ? "intro" : "idle");
        showSpeechRef.current(greetingFor(loadNow, isSleeping(prepared.save, loadNow)));
      }
      const visitUnlocks = getNewBondUnlocks(
        loaded.bond.total,
        prepared.save.bond.total,
      );
      const retroactiveGiftUnlocks = unlocksForGifts(
        prepared.grantedGifts,
        prepared.save.bond.total,
      );
      for (const unlock of retroactiveGiftUnlocks) {
        if (!visitUnlocks.some((candidate) => candidate.id === unlock.id)) {
          visitUnlocks.push(unlock);
        }
      }
      if (visitUnlocks.length > 0) setUnlocks(visitUnlocks);
      if (prepared.capReached) {
        addToast("她今天已經好幸福了 💕", "info");
      }
    };

    if (!isOnline) {
      if (cached) void finishLoad(cached, false);
      else setSyncError("這台裝置還沒有雲朵小窩存檔，連線後再試一次吧。");
      return;
    }

    void loadCottageCloud(uid, undefined, loadNow)
      .then((cloudSave) => finishLoad(cloudSave, !cached && cloudSave.revision === 0))
      .catch((error: unknown) => {
        if (loadSequenceRef.current !== sequence) return;
        logger.error("Failed to load Cloud Cottage", error);
        if (cached) {
          setSyncStatus("offline");
          setSyncError("離線中，正在使用上次的雲朵小窩存檔。");
          void finishLoad(cached, false);
        } else {
          setSyncStatus("error");
          setSyncError("雲朵飄遠了一點，暫時進不了小窩。請檢查連線再試一次。");
        }
      });
    void refreshCoins(uid);

    return () => {
      loadSequenceRef.current += 1;
    };
  }, [addToast, isDemo, isOnline, refreshCoins, setVisibleSave, setVisibleSaveIfNewer, triggerAction, uid]);

  useEffect(() => {
    if (!uid || isDemo) return;
    const cacheKey = getCottageCacheKey(uid);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== cacheKey || !event.newValue) return;
      const incoming = parseCottageCacheValue(event.newValue, nowRef.current);
      if (incoming && compareCottageSaveVersions(incoming, saveRef.current) >= 0) {
        setVisibleSaveIfNewer(incoming);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isDemo, setVisibleSaveIfNewer, uid]);

  useEffect(() => {
    if (!uid || isDemo) return;
    const refreshVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void refreshCoins(uid);
      }
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [isDemo, refreshCoins, uid]);

  useEffect(() => {
    if (!uid || !isOnline || isDemo || !pendingCloudWriteRef.current) return;
    const current = saveRef.current;
    void loadCottageCloud(uid, undefined, nowRef.current)
      .then(async (cloud) => {
        if (comparePetSaveFreshness(cloud, current) > 0) {
          pendingCloudWriteRef.current = false;
          setVisibleSave(cloud);
          setSyncStatus("cloud");
          return;
        }
        const committed = await saveCottageCloud(uid, current);
        setVisibleSaveIfNewer(committed);
        pendingCloudWriteRef.current = false;
        setSyncStatus("cloud");
        setSyncError(null);
      })
      .catch((error: unknown) => logger.warn("Cloud Cottage reconnect sync failed", error));
  }, [isDemo, isOnline, setVisibleSave, setVisibleSaveIfNewer, uid]);

  useEffect(() => {
    const localDate = todayLocal(new Date(now));
    if (!uid || save.wish.date === localDate && save.freeFood.restockDate === localDate) return;
    let next = restockFreeFood(save, localDate, now);
    const wish = refreshDailyWish(next.wish, uid, localDate, next.inventory.toys);
    if (wish !== next.wish) next = touchPetSave({ ...next, wish }, now);
    if (next !== save) commitLocalSave(next);
  }, [commitLocalSave, now, save, uid]);

  useEffect(() => {
    const toggleFullscreen = () => {
      const operation = document.fullscreenElement
        ? document.exitFullscreen()
        : rootRef.current?.requestFullscreen();
      if (operation) {
        void operation.catch((error: unknown) => {
          logger.warn("Cloud Cottage fullscreen unavailable", error);
        });
      }
    };
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || isKeyboardShortcutTarget(event.target)) return;
      event.preventDefault();
      toggleFullscreen();
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const previousRender = window.render_game_to_text;
    const previousAdvance = window.advanceTime;
    window.render_game_to_text = () => {
      const current = saveRef.current;
      const currentNow = nowRef.current;
      const personalizationPreview = personalizationPreviewRef.current;
      const stats = deriveStats(current, currentNow);
      const bond = getBondProgress(current.bond.total);
      const wish = getWishDefinition(current.wish);
      return JSON.stringify({
        mode: !uid ? "signed-out" : syncStatus === "loading" ? "loading" : "playing",
        coordinateSystem: "The DOM scene uses normalized percentages: origin top-left, x rightward, y downward.",
        time: { now: currentNow, period: timeOfDayAt(currentNow) },
        sync: syncStatus,
        syncError,
        online: isOnline,
        panel,
        personalizationMode,
        personalizationDraft: personalizationPreview,
        personalizationBusy,
        shop: {
          category: shopKind,
          purchasingId,
          insufficientProductId,
        },
        bath: {
          rubCount: bathRubCount,
          readyToRinse: bathRubCount >= 3,
        },
        unlocks,
        fullscreen: isFullscreen,
        action: sceneAction,
        actionEmoji: actionEmoji ?? null,
        speech,
        pet: {
          sleeping: isSleeping(current, currentNow),
          stats: {
            fullness: Math.round(stats.fullness),
            clean: Math.round(stats.clean),
            mood: Math.round(stats.mood),
          },
          bond: {
            total: current.bond.total,
            level: bond.level,
            earnedToday: current.bond.earnedToday,
            dailyCap: DAILY_BOND_CAP,
          },
        },
        wish: {
          id: current.wish.wishId,
          label: wish?.nameZh ?? "",
          progress: current.wish.progress,
          target: current.wish.target,
          fulfilled: current.wish.fulfilled,
        },
        inventory: {
          freeFood: current.freeFood,
          snacks: current.inventory.snacks,
          toys: current.inventory.toys,
          outfits: current.inventory.outfits,
          furniture: current.inventory.furniture,
          wallpapers: current.inventory.wallpapers,
          floors: current.inventory.floors,
        },
        equipped: personalizationPreview?.mode === "wardrobe"
          ? personalizationPreview.equipped
          : current.equipped,
        room: personalizationPreview?.mode === "decorate"
          ? personalizationPreview.room
          : current.room,
        coins: coinBalance,
      });
    };
    window.advanceTime = (milliseconds: number) => {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
      const advanced = nowRef.current + milliseconds;
      timeOffsetRef.current = advanced - Date.now();
      nowRef.current = advanced;
      setNow(advanced);
    };
    return () => {
      window.render_game_to_text = previousRender;
      window.advanceTime = previousAdvance;
    };
  }, [
    actionEmoji,
    bathRubCount,
    coinBalance,
    insufficientProductId,
    isFullscreen,
    isOnline,
    panel,
    personalizationBusy,
    personalizationMode,
    purchasingId,
    sceneAction,
    shopKind,
    speech,
    syncStatus,
    syncError,
    uid,
    unlocks,
  ]);

  useEffect(() => () => {
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    stopSpeaking();
  }, [stopSpeaking]);

  const performCare = useCallback(
    (
      action: WishAction,
      animation: CottageSceneAction,
      fallback: CottageSpeechBubble,
      emoji?: string,
    ) => {
      if (!uid) return;
      const previous = saveRef.current;
      const result = applyCareActionWithWish(previous, uid, action, nowRef.current);
      if (!result.applied) {
        triggerAction(result.reason === "full" ? "feed" : "idle", emoji);
        showSpeech(careFailureMessage(result));
        return;
      }

      const actionNow = nowRef.current;
      const cloudCommit = !isDemo && isOnline
        ? commitCottageCareAction(uid, action, actionNow)
        : null;

      // Start the transaction before caching the optimistic result so it has
      // already captured the pre-action cache snapshot. Keeping the result in
      // cache protects it if the browser reports a network change while the
      // transaction is still pending.
      setVisibleSave(result.save);
      void writeCottageCache(uid, result.save);
      if (cloudCommit) {
        void cloudCommit
          .then((committed) => {
            const stillShowingThisAction =
              comparePetSaveFreshness(saveRef.current, result.save) === 0;
            if (stillShowingThisAction) setVisibleSave(committed.save);
            else setVisibleSaveIfNewer(committed.save);
            pendingCloudWriteRef.current = false;
            setSyncStatus("cloud");
            setSyncError(null);
            if (!committed.applied) {
              showSpeech(careFailureMessage(committed));
              addToast("另一個分頁剛剛先照顧過她，狀態已更新。", "info");
            }
          })
          .catch((error: unknown) => {
            setVisibleSaveIfNewer(result.save);
            void writeCottageCache(uid, result.save);
            queueCloudSave(result.save);
            logger.warn("Cloud Cottage care transaction deferred", error);
          });
      } else {
        if (!isDemo) queueCloudSave(result.save);
      }
      triggerAction(animation, emoji, animation === "sleep");
      showPhrase(result.phraseId, fallback);
      if (action.type === "feed") playEatSound();
      else if (action.type === "bath") playBubbleSound();
      else if (action.type === "play") playToySound();
      else if (action.type === "sleep") playLullabySound();
      else playHeartSound();

      if (result.newlyFulfilled) {
        addToast(
          result.wishBondAwarded > 0
            ? `今日心願完成！親密度 +${result.wishBondAwarded} 💕`
            : "今日心願完成！她今天已經好幸福了 💕",
          "success",
          4_000,
        );
        playHeartSound();
        triggerAction("celebrate");
      } else if (result.capReached) {
        addToast("她今天已經好幸福了 💕", "info");
      }

      const newUnlocks = getNewBondUnlocks(
        previous.bond.total,
        result.save.bond.total,
      );
      if (newUnlocks.length > 0) {
        setUnlocks(newUnlocks);
        triggerAction(
          newUnlocks.some((unlock) => unlock.type === "celebration")
            ? "celebrate"
            : "heartBurst",
        );
      }
    },
    [
      addToast,
      isDemo,
      isOnline,
      queueCloudSave,
      setVisibleSave,
      setVisibleSaveIfNewer,
      showPhrase,
      showSpeech,
      triggerAction,
      uid,
    ],
  );

  const handlePet = useCallback(
    (zone: "ears" | "tummy") => {
      performCare(
        { type: "pet" },
        zone === "ears" ? "earWiggle" : "roll",
        speechForPhrase(zone === "ears" ? "pet-ears" : "pet-tummy"),
        "💗",
      );
    },
    [performCare],
  );

  const handleWake = useCallback(() => {
    const result = wakePet(saveRef.current, nowRef.current);
    if (!result.applied) return;
    commitLocalSave(result.save, !isDemo);
    triggerAction("wake");
    showSpeech(speechForPhrase("wake-happy"));
  }, [commitLocalSave, isDemo, showSpeech, triggerAction]);

  const rubBathBubbles = useCallback((increments = 1) => {
    setBathRubCount((count) => {
      const next = Math.min(3, count + increments);
      if (next > count) playBubbleSound();
      return next;
    });
  }, []);

  const handleBathPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      bathPointerRef.current = { x: event.clientX, y: event.clientY };
      bathStrokeDistanceRef.current = 0;
      bathStrokeHandledRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handleBathPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const previous = bathPointerRef.current;
      if (!previous) return;
      bathStrokeDistanceRef.current += Math.hypot(
        event.clientX - previous.x,
        event.clientY - previous.y,
      );
      bathPointerRef.current = { x: event.clientX, y: event.clientY };
      const increments = Math.floor(bathStrokeDistanceRef.current / 36);
      if (increments <= 0) return;
      bathStrokeDistanceRef.current %= 36;
      bathStrokeHandledRef.current = true;
      rubBathBubbles(increments);
    },
    [rubBathBubbles],
  );

  const handleBathPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      bathPointerRef.current = null;
      bathStrokeDistanceRef.current = 0;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      sceneAction === "sleep"
      && save.sleepingUntil !== null
      && !isSleeping(save, now)
    ) {
      handleWake();
    }
  }, [handleWake, now, save, sceneAction]);

  useEffect(() => {
    if (
      !uid
      || panel !== null
      || sceneAction !== "idle"
      || isSleeping(save, now)
      || syncStatus === "loading"
      || syncStatus === "cache"
    ) return;

    const idleActions = getUnlockedContent(
      getBondProgress(save.bond.total).level,
      1,
    ).filter((unlock) => unlock.type === "action");
    const hour = new Date(now).getHours();
    const canNap = hour >= 7 && hour < 19;
    if (idleActions.length === 0 && !canNap) return;

    const timer = window.setTimeout(() => {
      if (canNap && (idleActions.length === 0 || Math.random() < 0.3)) {
        triggerAction("nap", "💤");
        return;
      }
      const unlock = idleActions[Math.floor(Math.random() * idleActions.length)];
      triggerAction(ACTION_SCENES[unlock.id] ?? "celebrate", ACTION_EMOJI[unlock.id]);
    }, 24_000 + Math.floor(Math.random() * 18_000));
    return () => window.clearTimeout(timer);
  }, [now, panel, save, sceneAction, syncStatus, triggerAction, uid]);

  const handlePurchase = useCallback(
    async (productId: CottageProductId) => {
      if (!uid || purchasingId) return;
      const product = getProduct(productId);
      if (!product) return;
      if (!isDemo && (!isOnline || syncStatus !== "cloud" || coinBalance === null)) {
        addToast("連上雲端後才能安心購物喔。", "info");
        return;
      }
      if ((coinBalance ?? 0) < product.price) {
        setPanel(null);
        setInsufficientProductId(productId);
        return;
      }
      setPurchasingId(productId);
      try {
        if (isDemo) {
          const purchased = applyPurchase(saveRef.current, coinBalance ?? 0, productId, nowRef.current);
          if (!purchased.ok) {
            if (purchased.reason === "already-owned") {
              addToast("這個玩具已經在箱子裡囉！", "info");
            }
            return;
          }
          setCoinBalance(purchased.coinsAfter);
          commitLocalSave(purchased.save, false);
        } else {
          await cloudQueueRef.current.catch(() => undefined);
          const purchased = await purchaseCottageProduct(uid, productId);
          setVisibleSaveIfNewer(purchased.save);
          setCoinBalance(purchased.coinsAfter);
        }
        playSelectSound();
        addToast(`買到 ${product.nameZh} ${product.nameEn}！`, "success");
      } catch (error) {
        if (error instanceof CottageInsufficientCoinsError) {
          setCoinBalance(error.availableCoins);
          setPanel(null);
          setInsufficientProductId(productId);
        } else if (error instanceof CottageAlreadyOwnedError) {
          addToast("這個玩具已經在箱子裡囉！", "info");
        } else {
          logger.error("Cloud Cottage purchase failed", error);
          addToast("雲朵打了個噴嚏，再試一次。", "error");
        }
      } finally {
        setPurchasingId(null);
      }
    },
    [addToast, coinBalance, commitLocalSave, isDemo, isOnline, purchasingId, setVisibleSaveIfNewer, syncStatus, uid],
  );

  const handlePersonalizationSave = useCallback(
    async (actions: PersonalizationAction[]) => {
      if (!uid || personalizationBusy) return;
      if (actions.length === 0) {
        setPersonalizationMode(null);
        return;
      }

      const actionNow = nowRef.current;
      const previous = saveRef.current;
      let optimistic = previous;
      const optimisticGifts: BondGift[] = [];
      for (const action of actions) {
        const result = applyPersonalizationAction(
          optimistic,
          action,
          actionNow,
        );
        optimistic = result.save;
        optimisticGifts.push(...result.grantedGifts);
      }

      setPersonalizationBusy(true);
      setVisibleSave(optimistic);
      try {
        let committedSave = optimistic;
        const committedGifts: BondGift[] = [];
        if (isDemo || !isOnline) {
          commitLocalSave(optimistic, !isDemo);
        } else {
          await cloudQueueRef.current.catch(() => undefined);
          const committed = await commitCottagePersonalizationActions(
            uid,
            actions,
            actionNow,
          );
          committedSave = committed.save;
          committedGifts.push(...committed.grantedGifts);
          // The batch rebases against the freshest cloud/cache snapshot and
          // is authoritative even when one draft action became a no-op.
          setVisibleSave(committedSave);
          pendingCloudWriteRef.current = false;
          setSyncStatus("cloud");
          setSyncError(null);
        }

        const gifts = committedGifts.length > 0
          ? committedGifts
          : optimisticGifts;
        const giftUnlocks = unlocksForGifts(gifts, committedSave.bond.total);
        if (giftUnlocks.length > 0) setUnlocks(giftUnlocks);

        const addedFurniture = [...actions]
          .reverse()
          .find((action) => action.type === "add-furniture");
        if (addedFurniture?.type === "add-furniture") {
          const reaction = addedFurniture.furnitureId === "sofa"
            ? "sit"
            : addedFurniture.furnitureId === "cloud-bed"
              ? "nestle"
              : "admire";
          triggerAction(reaction, reaction === "sit" ? "💕" : "✨");
          showSpeech(speechForPhrase(
            reaction === "sit"
              ? "so-comfy"
              : reaction === "nestle"
                ? "cozy-clouds"
                : "sniff-furniture",
          ));
        } else if (
          actions.some((action) => action.type === "equip-outfit")
        ) {
          triggerAction("spin", "✨");
          showSpeech(speechForPhrase("new-look"));
        }

        playHeartSound();
        setPersonalizationMode(null);
      } catch (error) {
        // A connection can disappear after the editor opened. Keep the exact
        // optimistic snapshot in cache and let the existing reconnect queue
        // synchronize it later instead of discarding the player's layout.
        commitLocalSave(optimistic, !isDemo);
        setPersonalizationMode(null);
        addToast("已先把佈置留在這台裝置，連線後會自動同步。", "info");
        logger.warn("Cloud Cottage personalization deferred", error);
      } finally {
        setPersonalizationBusy(false);
      }
    },
    [
      addToast,
      commitLocalSave,
      isDemo,
      isOnline,
      personalizationBusy,
      setVisibleSave,
      showSpeech,
      triggerAction,
      uid,
    ],
  );

  const closePanel = useCallback(() => setPanel(null), []);
  const stats = useMemo(() => deriveStats(save, now), [now, save]);
  const bond = useMemo(() => getBondProgress(save.bond.total), [save.bond.total]);
  const wishDefinition = useMemo(() => getWishDefinition(save.wish), [save.wish]);
  const sleeping = isSleeping(save, now);
  const currentTimeOfDay = timeOfDayAt(now);
  const unlockedActions = getUnlockedContent(bond.level, 1).filter(
    (unlock) => unlock.type === "action" || unlock.type === "celebration",
  );
  const insufficientProduct = insufficientProductId
    ? getProduct(insufficientProductId)
    : undefined;
  const canShop = isDemo || isOnline && syncStatus === "cloud" && coinBalance !== null;
  const isHydrating = syncStatus === "loading" || syncStatus === "cache";
  const activeToolbarAction: CottageToolbarAction | null =
    personalizationMode ?? panel;

  if (auth.loading && !isDemo) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-sky-100 to-pink-50" role="status">
        <div className="text-center text-sky-900">
          <span className="loading loading-spinner loading-lg" />
          <p className="mt-3 text-sm font-bold">正在找到雲朵小窩…</p>
        </div>
      </div>
    );
  }

  if (!auth.user && !isDemo) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-sky-100 via-white to-pink-100 px-4 py-5 text-slate-800">
        <header className="mx-auto flex max-w-5xl items-center justify-between">
          <button type="button" onClick={onExit} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-white/75 px-4 text-sm font-bold shadow-sm backdrop-blur-md">
            <ArrowLeft className="size-4" aria-hidden="true" /> 返回小遊戲
          </button>
        </header>
        <main className="mx-auto flex min-h-[75vh] max-w-lg items-center justify-center">
          <section className="w-full rounded-[24px] border border-white/70 bg-white/82 p-7 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-200 to-pink-200 text-4xl shadow-lg">☁️</div>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-sky-950">登入後回到小窩</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              大耳狗的狀態、親密度、心願與買到的點心玩具，都會安全存在你的雲端存檔。
            </p>
            {auth.authError ? <p className="mt-4 rounded-[10px] bg-error/10 px-3 py-2 text-sm text-error" role="alert">{auth.authError}</p> : null}
            <button
              type="button"
              onClick={() => void auth.signInWithGoogle().catch((error: unknown) => logger.error("Cottage sign-in failed", error))}
              className="btn btn-primary mt-6 min-h-11 w-full rounded-[10px]"
            >
              <LogIn className="size-4" aria-hidden="true" /> 使用 Google 登入
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (syncStatus === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-sky-100 to-pink-50 p-5 text-slate-800">
        <section className="w-full max-w-md rounded-[22px] border border-white/70 bg-white/85 p-7 text-center shadow-xl backdrop-blur-xl">
          <div className="text-5xl" aria-hidden="true">🌧️</div>
          <h1 className="mt-4 text-2xl font-black">暫時找不到小窩</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{syncError}</p>
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary mt-6 min-h-11 rounded-[10px]">
            <RefreshCw className="size-4" aria-hidden="true" /> 再試一次
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="min-h-dvh overflow-x-hidden bg-gradient-to-b from-sky-100 via-[#f7fcff] to-pink-100 text-slate-800"
      data-cottage-root
    >
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-xl sm:px-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/75 text-sky-900 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="返回小遊戲"
            >
              <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="min-w-0">
              <span className="block truncate text-base font-black tracking-tight text-sky-950 sm:text-lg">大耳狗的雲朵小窩</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-700 sm:text-xs">
                {syncStatus === "offline" ? <WifiOff className="size-3" aria-hidden="true" /> : <Cloud className="size-3" aria-hidden="true" />}
                {syncLabel(syncStatus)}
              </span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50/90 px-3 text-sm font-black text-amber-800 shadow-sm" aria-label={`扭蛋代幣 ${coinBalance ?? "讀取中"}`}>
              <CircleDollarSign className="size-4" strokeWidth={2} aria-hidden="true" />
              {coinBalance ?? "…"}
            </div>
            <button
              type="button"
              onClick={() => setPanel("settings")}
              className="inline-flex size-11 items-center justify-center rounded-full bg-white/75 text-slate-700 shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="小窩設定"
            >
              <Settings className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full max-w-6xl space-y-3 px-3 pb-40 pt-3 sm:space-y-4 sm:px-5 sm:py-5 ${isHydrating ? "select-none opacity-75" : ""}`}
        aria-busy={isHydrating}
        inert={isHydrating}
      >
        {syncError ? (
          <div className="flex items-start gap-2 rounded-[12px] border border-amber-300/60 bg-amber-50/90 px-3 py-2.5 text-xs font-semibold text-amber-900 shadow-sm" role="status">
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {syncError}
          </div>
        ) : null}
        {coinError ? (
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-rose-300/60 bg-rose-50/90 px-3 py-2.5 text-xs font-semibold text-rose-900" role="alert">
            <span>{coinError}</span>
            <button type="button" onClick={() => uid && void refreshCoins(uid)} className="min-h-11 rounded-[8px] bg-white px-3 font-bold shadow-sm">重試</button>
          </div>
        ) : null}

        <CottageStatusBar
          fullness={stats.fullness}
          clean={stats.clean}
          mood={stats.mood}
          level={bond.level}
          levelTitle={bond.titleZh}
          bondTotal={save.bond.total}
          bondProgress={bond.earnedInLevel}
          bondNeeded={bond.nextThreshold === null ? 0 : bond.nextThreshold - bond.currentThreshold}
          dailyEarned={save.bond.earnedDate === todayLocal(new Date(now)) ? save.bond.earnedToday : 0}
          dailyCap={DAILY_BOND_CAP}
        />

        <CottageScene
          room={save.room}
          equipped={save.equipped}
          timeOfDay={currentTimeOfDay}
          action={sleeping && sceneAction === "idle" ? "sleep" : sceneAction}
          actionKey={sceneActionKey}
          isSleeping={sleeping}
          speech={speech}
          wishLabel={save.wish.fulfilled ? "今天的心願完成了 💕" : wishDefinition?.nameZh ?? "想和你一起玩"}
          wishProgress={save.wish.fulfilled ? undefined : save.wish.target > 1 ? `${save.wish.progress} / ${save.wish.target}` : undefined}
          actionEmoji={actionEmoji}
          reducedMotion={reducedMotion}
          onPet={handlePet}
          onWake={handleWake}
        />

        <CottageToolbar
          active={activeToolbarAction}
          sleeping={sleeping}
          disabled={sleeping
            ? {
                food: true,
                bath: true,
                toys: true,
                shop: true,
                decorate: true,
                wardrobe: true,
                actions: true,
              }
            : false}
          onFood={() => {
            playSelectSound();
            setPanel("food");
          }}
          onBath={() => {
            playSelectSound();
            setBathRubCount(0);
            setPanel("bath");
          }}
          onToys={() => {
            playSelectSound();
            setPanel("toys");
          }}
          onShop={() => {
            playSelectSound();
            setPanel("shop");
          }}
          onDecorate={() => {
            playSelectSound();
            setPanel(null);
            setPersonalizationMode("decorate");
          }}
          onWardrobe={() => {
            playSelectSound();
            setPanel(null);
            setPersonalizationMode("wardrobe");
          }}
          onActions={() => {
            playSelectSound();
            setPanel("actions");
          }}
          onSleep={() => {
            playSelectSound();
            if (sleeping) handleWake();
            else {
              performCare(
                { type: "sleep" },
                "sleep",
                speechForPhrase("good-night"),
                "💤",
              );
            }
          }}
          onSettings={() => {
            playSelectSound();
            setPanel("settings");
          }}
        />
      </main>

      {personalizationMode === "decorate" ? (
        <RoomEditor
          save={save}
          busy={personalizationBusy}
          onCancel={() => setPersonalizationMode(null)}
          onPreviewChange={handleRoomPreviewChange}
          onSave={handlePersonalizationSave}
        />
      ) : null}

      {personalizationMode === "wardrobe" ? (
        <Wardrobe
          save={save}
          busy={personalizationBusy}
          onCancel={() => setPersonalizationMode(null)}
          onPreviewChange={handleWardrobePreviewChange}
          onSave={handlePersonalizationSave}
        />
      ) : null}

      <CottagePanel open={panel === "food"} title="點心櫃" eyebrow="Snack cupboard" onClose={closePanel} reducedMotion={reducedMotion}>
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-black text-slate-700">每天補充的基本糧</h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {FREE_FOODS.map((food) => (
                <button
                  key={food.id}
                  type="button"
                  data-food-id={food.id}
                  onClick={() => {
                    performCare({ type: "feed", foodId: food.id }, "feed", speechForPhrase("yummy"), FOOD_EMOJI[food.id]);
                    closePanel();
                  }}
                  className="min-h-28 rounded-[16px] border border-sky-200 bg-sky-50 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <span className="text-3xl" aria-hidden="true">{FOOD_EMOJI[food.id]}</span>
                  <span className="mt-2 block text-sm font-black">{food.nameZh}</span>
                  <span className="block text-xs text-slate-500">{food.nameEn}</span>
                  <span className="mt-1 block text-xs font-bold text-sky-700">剩下 {save.freeFood[food.id]} 份</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-700">買到的進階點心</h3>
              <button type="button" onClick={() => { setShopKind("snack"); setPanel("shop"); }} className="min-h-11 rounded-[9px] bg-pink-50 px-3 text-xs font-bold text-pink-700">去商店</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SNACKS.map((food) => {
                const count = save.inventory.snacks[food.id as SnackId] ?? 0;
                return (
                  <button
                    key={food.id}
                    type="button"
                    data-food-id={food.id}
                    disabled={count <= 0}
                    onClick={() => {
                      performCare({ type: "feed", foodId: food.id }, "feed", speechForPhrase("yummy"), FOOD_EMOJI[food.id]);
                      closePanel();
                    }}
                    className="min-h-28 rounded-[14px] border border-pink-200 bg-pink-50 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
                  >
                    <span className="text-2xl" aria-hidden="true">{FOOD_EMOJI[food.id]}</span>
                    <span className="mt-1 block text-xs font-black">{food.nameZh}</span>
                    <span className="block truncate text-[10px] text-slate-500">{food.nameEn}</span>
                    <span className="mt-1 block text-[11px] font-bold text-pink-700">擁有 {count}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </CottagePanel>

      <CottagePanel open={panel === "bath"} title="泡泡澡" eyebrow="Bubble bath" onClose={closePanel} reducedMotion={reducedMotion}>
        <div className="text-center">
          <motion.button
            type="button"
            data-bath-rub
            onPointerDown={handleBathPointerDown}
            onPointerMove={handleBathPointerMove}
            onPointerUp={handleBathPointerEnd}
            onPointerCancel={handleBathPointerEnd}
            onClick={() => {
              if (bathStrokeHandledRef.current) {
                bathStrokeHandledRef.current = false;
                return;
              }
              rubBathBubbles();
            }}
            animate={reducedMotion ? undefined : { rotate: [-2, 2, -2], scale: [1, 1.03, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="mx-auto flex size-48 touch-none items-center justify-center rounded-full border-8 border-white bg-gradient-to-br from-sky-100 to-cyan-200 text-6xl shadow-[inset_0_0_35px_rgba(255,255,255,0.9),0_18px_40px_rgba(14,165,233,0.18)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
            aria-label="搓泡泡，點三次就可以沖水"
          >
            {bathRubCount >= 3 ? "🫧✨" : "🫧"}
          </motion.button>
          <p className="mt-4 text-sm font-bold text-sky-900">
            {bathRubCount >= 3 ? "泡泡搓得香香的，可以沖水囉！" : `輕輕搓泡泡 ${bathRubCount} / 3`}
          </p>
          <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
            {[0, 1, 2].map((step) => <span key={step} className={`size-3 rounded-full ${step < bathRubCount ? "bg-sky-500" : "bg-sky-100"}`} />)}
          </div>
          <button
            type="button"
            data-bath-rinse
            disabled={bathRubCount < 3}
            onClick={() => {
              performCare({ type: "bath" }, "bath", speechForPhrase("bubbles"), "🫧");
              closePanel();
            }}
            className="btn btn-primary mt-6 min-h-11 w-full rounded-[10px] disabled:opacity-40"
          >
            沖水洗香香
          </button>
        </div>
      </CottagePanel>

      <CottagePanel open={panel === "toys"} title="玩具箱" eyebrow="Toy box" onClose={closePanel} reducedMotion={reducedMotion}>
        {save.inventory.toys.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-5xl" aria-hidden="true">🧸</div>
            <h3 className="mt-3 text-lg font-black">玩具箱還空空的</h3>
            <p className="mt-1 text-sm text-slate-500">去商店挑一個最喜歡的玩具吧！</p>
            <button type="button" onClick={() => { setShopKind("toy"); setPanel("shop"); }} className="btn btn-primary mt-5 min-h-11 rounded-[10px]">去玩具商店</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {save.inventory.toys.map((toyId) => {
              const toy = getToy(toyId);
              if (!toy) return null;
              return (
                <button
                  key={toy.id}
                  type="button"
                  data-toy-id={toy.id}
                  onClick={() => {
                    performCare(
                      { type: "play", toyId: toy.id },
                      TOY_SCENES[toy.id],
                      speechForPhrase(TOY_PHRASES[toy.id]),
                      TOY_EMOJI[toy.id],
                    );
                    closePanel();
                  }}
                  className="min-h-32 rounded-[16px] border border-violet-200 bg-violet-50 p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <span className="text-4xl" aria-hidden="true">{TOY_EMOJI[toy.id]}</span>
                  <span className="mt-2 block text-sm font-black">{toy.nameZh}</span>
                  <span className="block text-xs text-slate-500">{toy.nameEn}</span>
                </button>
              );
            })}
          </div>
        )}
      </CottagePanel>

      <CottageShopPanel
        open={panel === "shop"}
        save={save}
        coins={coinBalance}
        online={canShop}
        busy={purchasingId}
        category={shopKind}
        reducedMotion={reducedMotion}
        onCategoryChange={setShopKind}
        onPurchase={handlePurchase}
        onSpeak={(english, chinese) =>
          showSpeech({ en: english, zh: chinese })}
        onClose={closePanel}
        onOpenWardrobe={() => {
          closePanel();
          setPersonalizationMode("wardrobe");
        }}
        onOpenDecorate={() => {
          closePanel();
          setPersonalizationMode("decorate");
        }}
      />

      <CottagePanel open={panel === "actions"} title="她會的動作" eyebrow="Bond actions" onClose={closePanel} reducedMotion={reducedMotion}>
        {unlockedActions.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-5xl" aria-hidden="true">⭐</div>
            <h3 className="mt-3 text-lg font-black">Lv.3 會解鎖第一個動作</h3>
            <p className="mt-1 text-sm text-slate-500">每天溫柔陪伴，她會慢慢學會更多可愛動作。</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {unlockedActions.map((unlock) => (
              <button
                key={unlock.id}
                type="button"
                data-action-id={unlock.id}
                onClick={() => {
                  closePanel();
                  triggerAction(ACTION_SCENES[unlock.id] ?? "celebrate", ACTION_EMOJI[unlock.id]);
                  showSpeech({ en: unlock.nameEn, zh: unlock.nameZh });
                  playHeartSound();
                }}
                className="min-h-32 rounded-[16px] border border-fuchsia-200 bg-gradient-to-br from-violet-50 to-pink-50 p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
              >
                <span className="text-4xl" aria-hidden="true">{ACTION_EMOJI[unlock.id] ?? "✨"}</span>
                <span className="mt-2 block text-sm font-black">{unlock.nameZh}</span>
                <span className="block text-xs text-slate-500">{unlock.nameEn}</span>
              </button>
            ))}
          </div>
        )}
      </CottagePanel>

      <CottagePanel open={panel === "settings"} title="小窩設定" eyebrow="Cottage settings" onClose={closePanel} reducedMotion={reducedMotion}>
        <div className="space-y-4">
          <label className="flex min-h-16 items-center justify-between gap-4 rounded-[14px] border border-slate-200/80 bg-white/85 px-4 py-3">
            <span>
              <span className="block text-sm font-black">遊戲音效</span>
              <span className="block text-xs text-slate-500">泡泡、愛心與玩具的輕柔音效</span>
            </span>
            <input type="checkbox" className="toggle toggle-primary" checked={!audio.settings.muted} onChange={(event) => audio.setMuted(!event.target.checked)} aria-label="開啟遊戲音效" />
          </label>
          <label className="block rounded-[14px] border border-slate-200/80 bg-white/85 px-4 py-3">
            <span className="flex items-center justify-between text-sm font-black">
              <span>音效大小</span><span>{Math.round(audio.settings.sfx * 100)}%</span>
            </span>
            <input type="range" min="0" max="1" step="0.05" value={audio.settings.sfx} onChange={(event) => audio.setSfxVolume(Number(event.target.value))} className="range range-primary range-sm mt-3" aria-label="遊戲音效音量" />
          </label>
          <label className="flex min-h-16 items-center justify-between gap-4 rounded-[14px] border border-slate-200/80 bg-white/85 px-4 py-3">
            <span>
              <span className="block text-sm font-black">英文語音</span>
              <span className="block text-xs text-slate-500">關閉後仍會顯示英文與中文字幕</span>
            </span>
            <input type="checkbox" className="toggle toggle-primary" checked={audio.settings.speechEnabled} onChange={(event) => { audio.setSpeechEnabled(event.target.checked); if (!event.target.checked) stopSpeaking(); }} aria-label="開啟英文語音" />
          </label>
          <button
            type="button"
            onClick={() => {
              const operation = document.fullscreenElement
                ? document.exitFullscreen()
                : rootRef.current?.requestFullscreen();
              if (operation) {
                void operation.catch((error: unknown) => {
                  logger.warn("Cloud Cottage fullscreen unavailable", error);
                });
              }
            }}
            className="flex min-h-16 w-full items-center justify-between gap-4 rounded-[14px] border border-slate-200/80 bg-white/85 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-black">全螢幕</span>
              <span className="block text-xs text-slate-500">也可以按 F，按 Esc 離開</span>
            </span>
            {isFullscreen ? <Maximize2 className="size-5 text-sky-600" aria-hidden="true" /> : <Expand className="size-5 text-sky-600" aria-hidden="true" />}
          </button>
          <div className="rounded-[14px] bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
            <Heart className="mr-1 inline size-4" aria-hidden="true" />
            小窩採用溫柔模式：不會生病、不會離家，親密度也永遠不會下降。
          </div>
        </div>
      </CottagePanel>

      <CottagePanel
        open={Boolean(insufficientProduct)}
        title="代幣不夠呢…"
        eyebrow="A little more practice"
        onClose={() => setInsufficientProductId(null)}
        reducedMotion={reducedMotion}
        footer={
          <button
            type="button"
            onClick={() => openGameTab("/games/spirit")}
            className="btn btn-primary min-h-11 w-full rounded-[10px]"
          >
            🗺️ 前往單字大冒險
          </button>
        }
      >
        <div className="text-center">
          <div className="text-6xl" aria-hidden="true">☁️</div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            {insufficientProduct
              ? `${insufficientProduct.nameZh}需要 ${insufficientProduct.price} 代幣，目前有 ${coinBalance ?? 0}。要不要去單字大冒險賺一點？`
              : "要不要去單字大冒險賺一點？"}
          </p>
        </div>
      </CottagePanel>

      <CottagePanel open={unlocks.length > 0} title="親密度升級了！" eyebrow="New bond unlock" onClose={() => setUnlocks([])} reducedMotion={reducedMotion}>
        <div className="space-y-3">
          <div className="text-center text-6xl" aria-hidden="true">💖</div>
          {unlocks.map((unlock) => (
            <div key={unlock.id} className="rounded-[16px] border border-pink-200 bg-gradient-to-r from-pink-50 to-violet-50 p-4 text-center">
              <p className="text-xs font-bold text-pink-600">Lv.{unlock.level} 新解鎖</p>
              <p className="mt-1 text-lg font-black">{unlock.nameZh}</p>
              <p className="text-sm text-slate-500">{unlock.nameEn}</p>
            </div>
          ))}
        </div>
      </CottagePanel>

      <AnimatePresence>
        {syncStatus === "loading" || syncStatus === "cache" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center"
            role="status"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-950/80 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md">
              <span className="loading loading-spinner loading-xs" /> 正在整理小窩…
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <span className="sr-only" aria-live="polite">{syncLabel(syncStatus)}</span>
      <span className="sr-only">
        {audio.settings.muted ? <VolumeX aria-label="音效已關閉" /> : <Volume2 aria-label="音效已開啟" />}
      </span>
    </div>
  );
}
