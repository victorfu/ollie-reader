import { ArrowLeft, Cloud, CloudOff, LogIn, Play, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import {
  createInitialWonderAcademyProgress,
  wonderAcademyProgressService,
} from "../../../services/wonderAcademyProgressService";
import type { WonderAcademyProgress } from "../../../types/wonderAcademy";
import WonderAcademyHost from "./WonderAcademyHost";
import {
  applyWonderAcademyAction,
  createInitialWonderAcademyState,
  type WonderAcademyAction,
  type WonderAcademyState,
} from "./wonderAcademyLogic";

type WonderAcademyPageProps = {
  onExit?: () => void;
};

type SaveStatus = "loading" | "saved" | "saving" | "pending" | "failed";

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  loading: "Loading",
  saved: "Saved",
  saving: "Saving",
  pending: "Offline changes pending",
  failed: "Save failed",
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

function stampProgress(progress: WonderAcademyProgress): WonderAcademyProgress {
  return {
    ...progress,
    updatedAt: new Date().toISOString(),
  };
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

export default function WonderAcademyPage({ onExit }: WonderAcademyPageProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [state, setState] = useState<WonderAcademyState>(() =>
    createInitialWonderAcademyState({ progress: null }),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const saveSequenceRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeUserIdRef.current = user?.uid ?? null;
    saveSequenceRef.current += 1;
  }, [user?.uid]);

  useEffect(() => {
    if (authLoading || !user) return;

    let active = true;

    wonderAcademyProgressService
      .load(user.uid)
      .then((progress) => {
        if (!active) return;

        setState(createInitialWonderAcademyState({ progress }));
        setLoadedUserId(user.uid);
        setLoadError(null);
        setSaveStatus(hasPendingCloudSave(progress) ? "pending" : "saved");
      })
      .catch(() => {
        if (!active) return;

        setState(createInitialWonderAcademyState({ progress: null }));
        setLoadedUserId(user.uid);
        setLoadError("Progress could not be loaded. You can try again in a moment.");
        setSaveStatus("failed");
      });

    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const saveProgress = useCallback(async (progress: WonderAcademyProgress) => {
    if (activeUserIdRef.current !== progress.userId) return;

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

      setState((currentState) =>
        currentState.progress?.userId === result.progress.userId
          ? {
              ...createInitialWonderAcademyState({
                progress: result.progress,
                mode: currentState.mode,
              }),
              paused: currentState.paused,
              isPaused: currentState.isPaused,
              message: currentState.message,
              moodTrial: currentState.moodTrial,
              trial: currentState.trial,
            }
          : currentState,
      );
      setSaveStatus(result.cloudSaved ? "saved" : "pending");
    } catch {
      if (
        saveSequenceRef.current === sequence &&
        activeUserIdRef.current === progress.userId
      ) {
        setSaveStatus("failed");
      }
    }
  }, []);

  const handleStartNewGame = useCallback(() => {
    if (!user) return;

    const progress = createInitialWonderAcademyProgress({
      userId: user.uid,
      starterSpeciesId: "lumi",
      starterNickname: "Lumi",
      playerName: user.displayName ?? null,
    });

    setState(createInitialWonderAcademyState({ progress }));
    setLoadedUserId(user.uid);
    void saveProgress(progress);
  }, [saveProgress, user]);

  const handleAction = useCallback(
    (action: WonderAcademyAction) => {
      setState((currentState) => {
        const nextState = applyWonderAcademyAction(currentState, action);

        if (nextState.progress && nextState.progress !== currentState.progress) {
          const progress = stampProgress(nextState.progress);
          const stateWithStampedProgress = createInitialWonderAcademyState({
            progress,
            mode: nextState.mode,
          });

          void saveProgress(progress);
          return {
            ...stateWithStampedProgress,
            paused: nextState.paused,
            isPaused: nextState.isPaused,
            message: nextState.message,
            moodTrial: nextState.moodTrial,
            trial: nextState.trial,
          };
        }

        return nextState;
      });
    },
    [saveProgress],
  );

  const effectiveSaveStatus: SaveStatus =
    authLoading || (user && loadedUserId !== user.uid) ? "loading" : saveStatus;
  const hasProgress = Boolean(state.progress);

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
                {hasProgress ? state.currentObjective.label : "Choose Lumi to begin"}
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
          <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center">
            <div className="w-full rounded-[14px] border border-border-hairline bg-card p-6 shadow-lg">
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
              {loadError && (
                <p className="mt-3 rounded-[8px] bg-error/10 px-3 py-2 text-sm text-error">
                  {loadError}
                </p>
              )}
              <button
                type="button"
                onClick={handleStartNewGame}
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
                {state.currentObjective.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {state.currentObjective.description}
              </p>
            </div>
            <WonderAcademyHost state={state} onAction={handleAction} />
          </div>
        )}
      </main>
    </div>
  );
}
