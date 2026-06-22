import { Map, Pause, Play, Sparkles, Utensils, WandSparkles } from "lucide-react";
import { getNodeById } from "../../../data/wonderAcademyData";
import type { WonderAcademyAction, WonderAcademyState } from "./wonderAcademyLogic";
import { selectAdjacentNodeIds } from "./wonderAcademyLogic";

type WonderAcademyHostProps = {
  state: WonderAcademyState;
  onAction: (action: WonderAcademyAction) => void;
};

export default function WonderAcademyHost({
  state,
  onAction,
}: WonderAcademyHostProps) {
  const adjacentNodeIds = selectAdjacentNodeIds(state);
  const currentNode = getNodeById(state.currentChapterId, state.currentNodeId);
  const hasProgress = Boolean(state.progress);
  const isPaused = state.paused || state.isPaused;
  const isMoodTrial = state.mode === "moodTrial";

  return (
    <section className="grid min-h-[560px] gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="relative overflow-hidden rounded-[10px] border border-border-hairline bg-card shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.6_0.2_250_/_18%),transparent_34%),linear-gradient(135deg,oklch(0.98_0_0),oklch(0.93_0.05_145))] dark:bg-[radial-gradient(circle_at_top_left,oklch(0.65_0.22_250_/_18%),transparent_34%),linear-gradient(135deg,oklch(0.18_0_0),oklch(0.16_0.04_145))]" />
        <div className="relative flex min-h-[560px] flex-col justify-between p-5 sm:p-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-hairline bg-background/75 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-md">
              <Sparkles className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {state.mode === "regionMap"
                ? "Sparkleaf Grove Map"
                : isMoodTrial
                  ? "Mood Trial"
                  : "Academy Hub"}
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {currentNode?.label ?? "Wonder Academy"}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {state.currentObjective.description}
            </p>
          </div>

          <div className="rounded-[10px] border border-border-hairline bg-background/75 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onAction({ type: "openRegionMap" })}
                disabled={!hasProgress}
                className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
              >
                <Map className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Map
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: "startMoodTrial", nodeId: state.currentNodeId })}
                disabled={!hasProgress || isPaused}
                className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
              >
                Mood Trial
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: "comfort" })}
                disabled={!isMoodTrial || isPaused}
                className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
              >
                Comfort
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: "skill", skillId: "tiny-flash" })}
                disabled={!isMoodTrial || isPaused}
                className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
              >
                <WandSparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Tiny Flash
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: "snack", snackId: "starberry-cookie" })}
                disabled={!isMoodTrial || isPaused}
                className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
              >
                <Utensils className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Snack
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: "attune" })}
                disabled={!isMoodTrial || isPaused}
                className="btn btn-primary btn-sm min-h-11 rounded-[6px]"
              >
                Attune
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: "togglePause" })}
                disabled={!hasProgress}
                className="btn btn-ghost btn-sm min-h-11 rounded-[6px]"
              >
                {isPaused ? (
                  <Play className="size-4" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Pause className="size-4" strokeWidth={1.75} aria-hidden="true" />
                )}
                {isPaused ? "Resume" : "Pause"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="rounded-[10px] border border-border-hairline bg-card p-4 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold">Current Objective</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.currentObjective.label}
          </p>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">Adjacent Nodes</h3>
          <div className="mt-2 space-y-2">
            {adjacentNodeIds.length > 0 ? (
              adjacentNodeIds.map((nodeId) => {
                const node = getNodeById(state.currentChapterId, nodeId);

                return (
                  <button
                    key={nodeId}
                    type="button"
                    onClick={() => onAction({ type: "moveToNode", nodeId })}
                    disabled={isPaused}
                    className="flex min-h-11 w-full items-center justify-between rounded-[6px] border border-border-hairline bg-background/60 px-3 py-2 text-left text-sm transition-colors hover:bg-accent-tint hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span>{node?.label ?? nodeId}</span>
                    <span className="text-xs text-muted-foreground">Move</span>
                  </button>
                );
              })
            ) : (
              <p className="rounded-[6px] bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                No unlocked adjacent nodes yet.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-[8px] bg-background/60 p-3 text-sm text-muted-foreground">
          <p>Status: {isPaused ? "Paused" : "Ready"}</p>
          {state.message && <p className="mt-2 text-foreground">{state.message}</p>}
        </div>
      </aside>
    </section>
  );
}
