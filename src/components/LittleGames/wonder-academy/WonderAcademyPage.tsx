import { ArrowLeft, Cloud, CloudOff, Home, LogIn, Play, Save, Volume2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import academyHubUrl from "../../../assets/games/wonder-academy/backgrounds/academy-hub.png";
import moodTrialUrl from "../../../assets/games/wonder-academy/backgrounds/mood-trial.png";
import sparkleafMapUrl from "../../../assets/games/wonder-academy/backgrounds/sparkleaf-map.png";
import lumiPortraitUrl from "../../../assets/games/wonder-academy/starters/lumi-portrait.png";
import momoPortraitUrl from "../../../assets/games/wonder-academy/starters/momo-portrait.png";
import nibiPortraitUrl from "../../../assets/games/wonder-academy/starters/nibi-portrait.png";
import picoPortraitUrl from "../../../assets/games/wonder-academy/starters/pico-portrait.png";
import mossmewPortraitUrl from "../../../assets/games/wonder-academy/wonderlings/mossmew-portrait.png";
import sparkleafFawnPortraitUrl from "../../../assets/games/wonder-academy/wonderlings/sparkleaf-fawn-portrait.png";
import { useAuth } from "../../../hooks/useAuth";
import {
  createInitialWonderAcademyProgress,
  wonderAcademyProgressService,
} from "../../../services/wonderAcademyProgressService";
import type {
  WonderAcademyAudioSettings,
  WonderAcademyProgress,
} from "../../../types/wonderAcademy";
import WonderAcademyHost from "./WonderAcademyHost";
import {
  applyWonderAcademyAction,
  createInitialWonderAcademyState,
  projectWonderAcademyProgress,
  type WonderAcademyAction,
  type WonderAcademyState,
} from "./wonderAcademyLogic";
import type { WonderAcademyAssets } from "./wonderAcademyGame";
import {
  createWonderAcademyAudio,
  type WonderAcademyAudioManager,
  type WonderAcademyLoopId,
} from "./wonderAcademyAudio";
import {
  canFlushPendingAudioProgress,
  createWonderAcademySaveTimestampIssuer,
  shouldKeepCurrentProgressOverSaveResult,
} from "./wonderAcademyPersistence";

type WonderAcademyPageProps = {
  onExit?: () => void;
};

type SaveStatus = "loading" | "saved" | "saving" | "pending" | "failed";

type SaveProgressOptions = {
  expectedUserId?: string | null;
  playCompletionSfx?: boolean;
};

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  loading: "Loading",
  saved: "Saved",
  saving: "Saving",
  pending: "Offline changes pending",
  failed: "Save failed",
};

const WONDER_ACADEMY_ASSETS: WonderAcademyAssets = {
  academyHub: academyHubUrl,
  sparkleafMap: sparkleafMapUrl,
  moodTrial: moodTrialUrl,
  lumiPortrait: lumiPortraitUrl,
  momoPortrait: momoPortraitUrl,
  picoPortrait: picoPortraitUrl,
  nibiPortrait: nibiPortraitUrl,
  mossmewPortrait: mossmewPortraitUrl,
  sparkleafFawnPortrait: sparkleafFawnPortraitUrl,
};

function SaveStatusIcon({ status }: { status: SaveStatus }) {
  if (status === "pending") {
    return <CloudOff className="size-4" strokeWidth={1.75} aria-hidden="true" />;
  }

  if (status === "saving") {
    return <Save className="size-4" strokeWidth={1.75} aria-hidden="true" />;
  }

  return <Cloud className="size-4" strokeWidth={1.75} aria-hidden="true" />;
}

function hasPendingCloudSave(progress: WonderAcademyProgress | null): boolean {
  if (!progress) return false;
  if (!progress.lastCloudSavedAt) return true;

  const updatedAtMs = Date.parse(progress.updatedAt);
  const cloudSavedAtMs = Date.parse(progress.lastCloudSavedAt);

  return (
    Number.isNaN(updatedAtMs) ||
    Number.isNaN(cloudSavedAtMs) ||
    cloudSavedAtMs < updatedAtMs
  );
}

function getLoadedSaveStatus({
  progress,
  source,
  cloudAvailable,
}: Awaited<ReturnType<typeof wonderAcademyProgressService.loadWithMetadata>>): SaveStatus {
  if (!progress) {
    return cloudAvailable ? "saved" : "failed";
  }

  if (!cloudAvailable && (source === "pending" || source === "cache")) {
    return "pending";
  }

  if (source === "pending" || source === "cache") {
    return "pending";
  }

  return hasPendingCloudSave(progress) ? "pending" : "saved";
}

function getLoopForMode(mode: WonderAcademyState["mode"]): WonderAcademyLoopId | null {
  if (mode === "title" || mode === "hub") {
    return "hub_loop";
  }

  if (mode === "regionMap") {
    return "region_map_loop";
  }

  if (mode === "moodTrial") {
    return "mood_trial_loop";
  }

  return null;
}

function isProjectedSaveAction(action: WonderAcademyAction): boolean {
  return [
    "moveToNode",
    "move-to-node",
    "attune",
    "returnHub",
    "togglePause",
    "toggle-pause",
    "openRegionMap",
    "startMoodTrial",
    "start-mood-trial",
  ].includes(action.type);
}

function withCommittedProgress(
  nextState: WonderAcademyState,
  progress: WonderAcademyProgress,
): WonderAcademyState {
  return {
    ...createInitialWonderAcademyState({
      progress,
      mode: nextState.mode,
    }),
    paused: nextState.paused,
    isPaused: nextState.isPaused,
    message: nextState.message,
    moodTrial: nextState.moodTrial,
    trial: nextState.trial,
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

type UseWonderAcademyAudioOptions = {
  hasProgress: boolean;
  mode: WonderAcademyState["mode"];
  settings?: WonderAcademyAudioSettings;
};

function useWonderAcademyAudio({
  hasProgress,
  mode,
  settings,
}: UseWonderAcademyAudioOptions) {
  const audioManagerRef = useRef<WonderAcademyAudioManager | null>(null);
  const activeLoopRef = useRef<WonderAcademyLoopId | null>(null);

  const getAudioManager = useCallback((
    initialSettings?: Partial<WonderAcademyAudioSettings> | null,
  ) => {
    if (!audioManagerRef.current) {
      audioManagerRef.current = createWonderAcademyAudio({ initialSettings });
    }

    return audioManagerRef.current;
  }, []);

  const applySettings = useCallback((
    nextSettings: Partial<WonderAcademyAudioSettings> | null,
  ) => getAudioManager(nextSettings).setSettings(nextSettings), [getAudioManager]);

  const playSfx = useCallback((
    id: Parameters<WonderAcademyAudioManager["playSfx"]>[0],
    initialSettings?: Partial<WonderAcademyAudioSettings> | null,
  ) => {
    getAudioManager(initialSettings).playSfx(id);
  }, [getAudioManager]);

  const stopAll = useCallback(() => {
    audioManagerRef.current?.stopAll();
    activeLoopRef.current = null;
  }, []);

  useEffect(() => {
    if (!settings) return;

    applySettings(settings);
  }, [applySettings, settings]);

  useEffect(() => {
    if (!hasProgress || !settings) {
      stopAll();
      return;
    }

    const manager = getAudioManager(settings);
    const nextLoop = getLoopForMode(mode);

    if (activeLoopRef.current && activeLoopRef.current !== nextLoop) {
      manager.stopLoop(activeLoopRef.current);
    }

    activeLoopRef.current = nextLoop;

    if (nextLoop) {
      manager.startLoop(nextLoop);
    }
  }, [getAudioManager, hasProgress, mode, settings, stopAll]);

  useEffect(() => stopAll, [stopAll]);

  return {
    applySettings,
    playSfx,
    stopAll,
  };
}

type WonderAcademySettingsPanelProps = {
  audioSettings: WonderAcademyAudioSettings;
  currentObjective: WonderAcademyState["currentObjective"];
  isPaused: boolean;
  onAudioSettingsCommit: () => void;
  onAudioSettingsPreview: (settings: Partial<WonderAcademyAudioSettings>) => void;
  onContinue: () => void;
  onReturnHub: () => void;
};

function WonderAcademySettingsPanel({
  audioSettings,
  currentObjective,
  isPaused,
  onAudioSettingsCommit,
  onAudioSettingsPreview,
  onContinue,
  onReturnHub,
}: WonderAcademySettingsPanelProps) {
  return (
    <div
      className={[
        "mt-4 flex flex-col gap-3 rounded-[10px] border border-border-hairline bg-card p-3 shadow-sm",
        isPaused ? "ring-1 ring-accent/40" : "",
      ].join(" ")}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {currentObjective.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPaused ? "Paused" : "Settings"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPaused && (
            <button
              type="button"
              onClick={onContinue}
              className="btn btn-primary btn-sm min-h-11 rounded-[6px]"
            >
              <Play className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Continue
            </button>
          )}
          <button
            type="button"
            onClick={onReturnHub}
            className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
          >
            <Home className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Return to Hub
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
        <label className="flex min-h-11 items-center gap-3 rounded-[6px] bg-background/50 px-3">
          <Volume2
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="w-24 text-sm font-medium">Music</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(audioSettings.musicVolume * 100)}
            onBlur={onAudioSettingsCommit}
            onChange={(event) =>
              onAudioSettingsPreview({
                musicVolume: Number(event.currentTarget.value) / 100,
              })
            }
            onKeyUp={onAudioSettingsCommit}
            onPointerUp={onAudioSettingsCommit}
            className="range range-primary range-xs"
            aria-label="Music volume"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {formatPercent(audioSettings.musicVolume)}
          </span>
        </label>

        <label className="flex min-h-11 items-center gap-3 rounded-[6px] bg-background/50 px-3">
          <Volume2
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="w-24 text-sm font-medium">SFX</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(audioSettings.sfxVolume * 100)}
            onBlur={onAudioSettingsCommit}
            onChange={(event) =>
              onAudioSettingsPreview({
                sfxVolume: Number(event.currentTarget.value) / 100,
              })
            }
            onKeyUp={onAudioSettingsCommit}
            onPointerUp={onAudioSettingsCommit}
            className="range range-primary range-xs"
            aria-label="SFX volume"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {formatPercent(audioSettings.sfxVolume)}
          </span>
        </label>

        <label className="flex min-h-11 items-center gap-3 rounded-[6px] bg-background/50 px-3">
          <input
            type="checkbox"
            checked={audioSettings.muted}
            onChange={(event) => {
              onAudioSettingsPreview({
                muted: event.currentTarget.checked,
              });
              queueMicrotask(onAudioSettingsCommit);
            }}
            className="toggle toggle-primary"
            aria-label="Mute audio"
          />
          <span className="text-sm font-medium">Mute</span>
        </label>
      </div>
    </div>
  );
}

export default function WonderAcademyPage({ onExit }: WonderAcademyPageProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [state, setState] = useState<WonderAcademyState>(() =>
    createInitialWonderAcademyState({ progress: null }),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const stateRef = useRef(state);
  const saveSequenceRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const pendingAudioProgressRef = useRef<WonderAcademyProgress | null>(null);
  const audioSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimestampIssuerRef = useRef(createWonderAcademySaveTimestampIssuer());

  const commitState = useCallback((nextState: WonderAcademyState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const effectiveSaveStatus: SaveStatus =
    authLoading || (user && loadedUserId !== user.uid)
      ? "loading"
      : user
        ? saveStatus
        : "saved";
  const activeState =
    user && loadedUserId === user.uid
      ? state
      : createInitialWonderAcademyState({ progress: null });
  const activeLoadError = user && loadedUserId === user.uid ? loadError : null;
  const hasProgress = Boolean(activeState.progress);
  const audioSettings = activeState.progress?.audioSettings;
  const isPaused = activeState.paused || activeState.isPaused;
  const { applySettings, playSfx, stopAll } = useWonderAcademyAudio({
    hasProgress,
    mode: activeState.mode,
    settings: audioSettings,
  });

  useEffect(() => {
    if (authLoading || !user) return;

    let active = true;
    const requestedUserId = user.uid;

    wonderAcademyProgressService
      .loadWithMetadata(requestedUserId)
      .then((result) => {
        if (!active || activeUserIdRef.current !== requestedUserId) return;

        commitState(createInitialWonderAcademyState({ progress: result.progress }));
        setLoadedUserId(requestedUserId);
        setLoadError(
          !result.cloudAvailable && !result.progress
            ? "Cloud progress could not be reached. Check your connection and try again."
            : null,
        );
        setSaveStatus(getLoadedSaveStatus(result));
      })
      .catch(() => {
        if (!active || activeUserIdRef.current !== requestedUserId) return;

        commitState(createInitialWonderAcademyState({ progress: null }));
        setLoadedUserId(requestedUserId);
        setLoadError("Progress could not be loaded. You can try again in a moment.");
        setSaveStatus("failed");
      });

    return () => {
      active = false;
    };
  }, [authLoading, commitState, user]);

  const saveProgress = useCallback(async (
    progress: WonderAcademyProgress,
    options: SaveProgressOptions = {},
  ) => {
    const expectedUserId = options.expectedUserId ?? activeUserIdRef.current;

    if (!expectedUserId || progress.userId !== expectedUserId) return;

    const { playCompletionSfx = true } = options;
    const sequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = sequence;
    setSaveStatus("saving");

    try {
      const result = await wonderAcademyProgressService.save(progress);

      if (
        saveSequenceRef.current !== sequence ||
        activeUserIdRef.current !== result.progress.userId
      ) {
        return;
      }

      const currentState = stateRef.current;
      const keepCurrentProgress = shouldKeepCurrentProgressOverSaveResult(
        currentState.progress,
        result.progress,
      );

      if (keepCurrentProgress) {
        setSaveStatus("pending");
        return;
      }

      if (currentState.progress?.userId === result.progress.userId) {
        commitState({
          ...createInitialWonderAcademyState({
            progress: result.progress,
            mode: currentState.mode,
          }),
          paused: currentState.paused,
          isPaused: currentState.isPaused,
          message: currentState.message,
          moodTrial: currentState.moodTrial,
          trial: currentState.trial,
        });
      }
      setSaveStatus(result.cloudSaved ? "saved" : "pending");
      if (playCompletionSfx) {
        playSfx(
          result.cloudSaved ? "save_success" : "save_pending",
          result.progress.audioSettings,
        );
      }
    } catch {
      if (
        saveSequenceRef.current === sequence &&
        activeUserIdRef.current === progress.userId
      ) {
        setSaveStatus("failed");
      }
    }
  }, [commitState, playSfx]);

  const projectAndSaveState = useCallback((
    previousProgress: WonderAcademyProgress,
    nextState: WonderAcademyState,
    now = saveTimestampIssuerRef.current.issueAfter(previousProgress.updatedAt),
  ) => {
    const progress = projectWonderAcademyProgress(previousProgress, nextState, now);
    const stateWithProgress = withCommittedProgress(nextState, progress);

    commitState(stateWithProgress);
    void saveProgress(progress);

    return progress;
  }, [commitState, saveProgress]);

  const flushPendingAudioSettings = useCallback((expectedUserId?: string | null) => {
    const progress = pendingAudioProgressRef.current;

    if (!progress) return;

    pendingAudioProgressRef.current = null;
    if (audioSaveTimerRef.current) {
      clearTimeout(audioSaveTimerRef.current);
      audioSaveTimerRef.current = null;
    }

    if (
      !canFlushPendingAudioProgress({
        activeUserId: activeUserIdRef.current,
        expectedUserId,
        progress,
      })
    ) {
      return;
    }

    void saveProgress(progress, {
      expectedUserId: expectedUserId ?? activeUserIdRef.current,
      playCompletionSfx: false,
    });
  }, [saveProgress]);

  const queueAudioSettingsSave = useCallback((progress: WonderAcademyProgress) => {
    pendingAudioProgressRef.current = progress;

    if (audioSaveTimerRef.current) {
      clearTimeout(audioSaveTimerRef.current);
    }

    audioSaveTimerRef.current = setTimeout(() => {
      flushPendingAudioSettings();
    }, 900);
  }, [flushPendingAudioSettings]);

  useLayoutEffect(() => {
    const userId = user?.uid ?? null;
    const previousUserId = activeUserIdRef.current;

    if (lastUserIdRef.current === userId) {
      activeUserIdRef.current = userId;
      return;
    }

    flushPendingAudioSettings(previousUserId);
    activeUserIdRef.current = userId;
    lastUserIdRef.current = userId;
    saveSequenceRef.current += 1;
    queueMicrotask(() => {
      if (activeUserIdRef.current !== userId) return;

      setLoadedUserId(null);
      setLoadError(null);
      setSaveStatus(userId ? "loading" : "saved");

      if (!userId) {
        commitState(createInitialWonderAcademyState({ progress: null }));
      }
    });
  }, [commitState, flushPendingAudioSettings, user?.uid]);

  const handleStartNewGame = useCallback((confirmOverwrite = false) => {
    if (!user) return;
    flushPendingAudioSettings();

    if (
      confirmOverwrite &&
      !window.confirm("Start a new Wonder Academy game and overwrite this save?")
    ) {
      return;
    }

    const progress = createInitialWonderAcademyProgress({
      userId: user.uid,
      starterSpeciesId: "lumi",
      starterNickname: "Lumi",
      playerName: user.displayName ?? null,
      now: saveTimestampIssuerRef.current.issueAfter(
        stateRef.current.progress?.updatedAt,
      ),
    });
    const progressWithCloudBase = {
      ...progress,
      lastCloudSavedAt: stateRef.current.progress?.lastCloudSavedAt ?? null,
    };

    commitState(createInitialWonderAcademyState({ progress: progressWithCloudBase }));
    setLoadedUserId(user.uid);
    void saveProgress(progressWithCloudBase);
  }, [commitState, flushPendingAudioSettings, saveProgress, user]);

  const handleResetNewGame = useCallback(() => {
    handleStartNewGame(true);
  }, [handleStartNewGame]);

  const handleAction = useCallback(
    (action: WonderAcademyAction) => {
      flushPendingAudioSettings();

      const currentState = stateRef.current;
      const nextState = applyWonderAcademyAction(currentState, action);
      const shouldSaveProgress =
        Boolean(currentState.progress && nextState.progress) &&
        (nextState.progress !== currentState.progress || isProjectedSaveAction(action));

      if (shouldSaveProgress && currentState.progress) {
        const projected = projectAndSaveState(currentState.progress, nextState);
        const actionType = action.type;

        if (
          (actionType === "attune" ||
            (actionType === "mood-trial" && action.move === "attune")) &&
          projected.wonderdex.mossmew === "attuned" &&
          currentState.wonderdex.mossmew !== "attuned"
        ) {
          playSfx("attune_success", projected.audioSettings);
          return;
        }

        playSfx("ui_select", projected.audioSettings);
        return;
      }

      commitState(nextState);
    },
    [commitState, flushPendingAudioSettings, playSfx, projectAndSaveState],
  );

  const handleAudioSettingsPreview = useCallback((
    settings: Partial<WonderAcademyAudioSettings>,
  ) => {
    const currentState = stateRef.current;
    const currentProgress = currentState.progress;

    if (!currentProgress) return;

    const nextAudioSettings = applySettings({
      ...currentProgress.audioSettings,
      ...settings,
    });
    const projected = projectWonderAcademyProgress(
      currentProgress,
      currentState,
      saveTimestampIssuerRef.current.issueAfter(currentProgress.updatedAt),
    );
    const progress = {
      ...projected,
      audioSettings: nextAudioSettings,
    };

    commitState(withCommittedProgress(currentState, progress));
    pendingAudioProgressRef.current = progress;
    queueAudioSettingsSave(progress);
  }, [applySettings, commitState, queueAudioSettingsSave]);

  const handleReturnHub = useCallback(() => {
    if (stateRef.current.paused || stateRef.current.isPaused) {
      handleAction({ type: "togglePause" });
    }

    handleAction({ type: "returnHub" });
  }, [handleAction]);

  useEffect(() => {
    const pauseTrialOnBackground = () => {
      flushPendingAudioSettings();

      const currentState = stateRef.current;

      if (
        !currentState.progress ||
        currentState.mode !== "moodTrial" ||
        currentState.paused ||
        currentState.isPaused
      ) {
        return;
      }

      const pausedState = applyWonderAcademyAction(currentState, { type: "togglePause" });
      projectAndSaveState(currentState.progress, pausedState);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pauseTrialOnBackground();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", pauseTrialOnBackground);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", pauseTrialOnBackground);
    };
  }, [flushPendingAudioSettings, projectAndSaveState]);

  useEffect(() => {
    return () => {
      flushPendingAudioSettings();
      stopAll();
    };
  }, [flushPendingAudioSettings, stopAll]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border-hairline bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] text-base-content/70 transition-colors hover:bg-accent-tint hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Back to games"
              >
                <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight">
                Wonder Academy
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {hasProgress ? activeState.currentObjective.label : "Choose Lumi to begin"}
              </p>
            </div>
          </div>

          <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border-hairline bg-card px-3 text-xs font-semibold text-muted-foreground shadow-sm">
            <SaveStatusIcon status={effectiveSaveStatus} />
            {SAVE_STATUS_LABELS[effectiveSaveStatus]}
          </div>
        </div>
      </header>

      <main className="px-3 py-4 sm:px-5 sm:py-5">
        {authLoading && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <span
              className="loading loading-spinner loading-lg text-primary"
              aria-label="Loading Wonder Academy"
            />
          </div>
        )}

        {!authLoading && !user && (
          <section className="mx-auto flex min-h-[60vh] max-w-xl items-center">
            <div className="w-full rounded-[14px] border border-border-hairline bg-card p-6 shadow-lg">
              <h2 className="text-2xl font-semibold tracking-tight">
                Sign in to play Wonder Academy
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Progress is safely saved to Firestore, so your Wonderling team can
                continue from another browser or device.
              </p>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="btn btn-primary mt-5 min-h-11 rounded-[6px]"
              >
                <LogIn className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Sign in with Google
              </button>
            </div>
          </section>
        )}

        {!authLoading && user && effectiveSaveStatus === "loading" && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <span
              className="loading loading-spinner loading-lg text-primary"
              aria-label="Loading saved progress"
            />
          </div>
        )}

        {!authLoading && user && effectiveSaveStatus !== "loading" && !hasProgress && (
          <section className="mx-auto grid min-h-[60vh] max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <WonderAcademyHost
              state={activeState}
              onAction={handleAction}
              assets={WONDER_ACADEMY_ASSETS}
            />

            <div className="self-center rounded-[14px] border border-border-hairline bg-card p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                New Game
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Start with Lumi
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Lumi is ready at the Academy Gate. This starter flow is temporary;
                expanded Wonderling choice arrives in a later task.
              </p>
              {activeLoadError && (
                <p className="mt-3 rounded-[8px] bg-error/10 px-3 py-2 text-sm text-error">
                  {activeLoadError}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleStartNewGame()}
                className="btn btn-primary mt-5 min-h-11 rounded-[6px]"
              >
                <Play className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Start New Game
              </button>
            </div>
          </section>
        )}

        {!authLoading && user && effectiveSaveStatus !== "loading" && hasProgress && (
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 rounded-[10px] border border-border-hairline bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Current Objective
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {activeState.currentObjective.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeState.currentObjective.description}
              </p>
            </div>
            <WonderAcademyHost
              state={activeState}
              onAction={handleAction}
              assets={WONDER_ACADEMY_ASSETS}
            />
            {audioSettings && (
              <WonderAcademySettingsPanel
                audioSettings={audioSettings}
                currentObjective={activeState.currentObjective}
                isPaused={isPaused}
                onAudioSettingsCommit={flushPendingAudioSettings}
                onAudioSettingsPreview={handleAudioSettingsPreview}
                onContinue={() => handleAction({ type: "togglePause" })}
                onReturnHub={handleReturnHub}
              />
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleResetNewGame}
                className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
              >
                Start New Game
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
