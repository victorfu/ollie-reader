import { describe, expect, it } from "vitest";
import { createInitialWonderAcademyProgress } from "../../../services/wonderAcademyProgressService";
import {
  applyWonderAcademyAction,
  createInitialWonderAcademyState,
  projectWonderAcademyProgress,
  selectAdjacentNodeIds,
} from "./wonderAcademyLogic";

const createProgress = () =>
  createInitialWonderAcademyProgress({
    userId: "keeper-1",
    now: "2026-06-22T00:00:00.000Z",
  });

describe("Wonder Academy pure game logic", () => {
  it("starts in title when no progress exists", () => {
    const state = createInitialWonderAcademyState({ progress: null });

    expect(state.mode).toBe("title");
    expect(state.currentObjective.label).toBe("選擇你的第一位 Wonderling 夥伴");
  });

  it("continues to hub with saved progress at the academy gate", () => {
    const state = createInitialWonderAcademyState({ progress: createProgress() });

    expect(state.mode).toBe("hub");
    expect(state.currentChapterId).toBe("sparkleaf-grove");
    expect(state.currentNodeId).toBe("academy-gate");
    expect(state.unlockedNodeIds).toEqual(["academy-gate", "firefly-clearing"]);
    expect(state.completedNodeIds).toEqual([]);
    expect(state.wonderdex.lumi).toBe("attuned");
    expect(state.paused).toBe(false);
    expect(state.moodTrial).toBeNull();
    expect(state.progress?.storyProgress.currentNodeId).toBe("academy-gate");
    expect(state.currentObjective.targetNodeId).toBe("firefly-clearing");
  });

  it("resumes reconstructable saved modes without transient trial state", () => {
    const regionMapProgress = {
      ...createProgress(),
      lastSafeResumePoint: "regionMap",
    };
    const legacyTrialProgress = {
      ...createProgress(),
      lastSafeResumePoint: "moodTrial",
    };

    const regionMapState = createInitialWonderAcademyState({ progress: regionMapProgress });
    const legacyTrialState = createInitialWonderAcademyState({
      progress: legacyTrialProgress,
    });

    expect(regionMapState.mode).toBe("regionMap");
    expect(regionMapState.moodTrial).toBeNull();
    expect(regionMapState.trial).toBeNull();
    expect(legacyTrialState.mode).toBe("regionMap");
    expect(legacyTrialState.moodTrial).toBeNull();
    expect(legacyTrialState.trial).toBeNull();
  });

  it("selects only adjacent unlocked map nodes from the academy gate", () => {
    const state = createInitialWonderAcademyState({ progress: createProgress() });

    expect(selectAdjacentNodeIds(state)).toEqual(["firefly-clearing"]);
  });

  it("moves to an adjacent unlocked node and stays in map flow", () => {
    const state = createInitialWonderAcademyState({
      progress: createProgress(),
      mode: "regionMap",
    });

    const nextState = applyWonderAcademyAction(state, {
      type: "moveToNode",
      nodeId: "firefly-clearing",
    });

    expect(nextState.mode).toBe("regionMap");
    expect(nextState.currentNodeId).toBe("firefly-clearing");
    expect(nextState.progress?.storyProgress.currentNodeId).toBe("firefly-clearing");
    expect(nextState.currentObjective.id).toBe("comfort-mossmew");
  });

  it("blocks movement to a non-adjacent locked node", () => {
    const state = createInitialWonderAcademyState({
      progress: createProgress(),
      mode: "regionMap",
    });

    const nextState = applyWonderAcademyAction(state, {
      type: "moveToNode",
      nodeId: "sparkleaf-warden",
    });

    expect(nextState.progress?.storyProgress.currentNodeId).toBe("academy-gate");
    expect(nextState.message).toContain("還不能前往");
  });

  it("toggles pause without changing the current objective and blocks gameplay while paused", () => {
    const state = createInitialWonderAcademyState({
      progress: createProgress(),
      mode: "regionMap",
    });
    const pausedState = applyWonderAcademyAction(state, { type: "togglePause" });
    const movedWhilePaused = applyWonderAcademyAction(pausedState, {
      type: "moveToNode",
      nodeId: "firefly-clearing",
    });
    const trialWhilePaused = applyWonderAcademyAction(pausedState, { type: "comfort" });
    const unpausedState = applyWonderAcademyAction(pausedState, { type: "togglePause" });

    expect(pausedState.isPaused).toBe(true);
    expect(pausedState.paused).toBe(true);
    expect(pausedState.currentObjective).toEqual(state.currentObjective);
    expect(movedWhilePaused.progress?.storyProgress.currentNodeId).toBe("academy-gate");
    expect(movedWhilePaused.currentNodeId).toBe("academy-gate");
    expect(movedWhilePaused.currentObjective).toEqual(state.currentObjective);
    expect(trialWhilePaused.trial).toEqual(pausedState.trial);
    expect(trialWhilePaused.moodTrial).toEqual(pausedState.moodTrial);
    expect(trialWhilePaused.currentObjective).toEqual(state.currentObjective);
    expect(unpausedState.isPaused).toBe(false);
    expect(unpausedState.paused).toBe(false);
    expect(unpausedState.currentObjective).toEqual(state.currentObjective);
  });

  it("completes the first Mood Trial after comfort, snack, and a matching skill open Mossmew", () => {
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: createProgress(), mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );
    const started = applyWonderAcademyAction(atClearing, {
      type: "startMoodTrial",
      nodeId: atClearing.currentNodeId,
    });
    const comforted = applyWonderAcademyAction(started, { type: "comfort" });
    const snacked = applyWonderAcademyAction(comforted, {
      type: "snack",
      snackId: "starberry-cookie",
    });
    const skilled = applyWonderAcademyAction(snacked, {
      type: "skill",
      skillId: "tiny-flash",
    });
    const attuned = applyWonderAcademyAction(skilled, { type: "attune" });

    expect(started.mode).toBe("moodTrial");
    expect(started.moodTrial?.opponentSpeciesId).toBe("mossmew");
    expect(skilled.trial?.opponentDisposition).toBe("open");
    expect(skilled.moodTrial?.opponentDisposition).toBe("open");
    expect(skilled.trial?.mood).toBe("calm");
    expect(attuned.mode).toBe("regionMap");
    expect(attuned.currentNodeId).toBe("firefly-clearing");
    expect(attuned.completedNodeIds).toContain("firefly-clearing");
    expect(attuned.unlockedNodeIds).toContain("mossy-bridge");
    expect(attuned.wonderdex.mossmew).toBe("attuned");
    expect(attuned.moodTrial).toBeNull();
    expect(attuned.progress?.completedNodeIds).toContain("firefly-clearing");
    expect(attuned.progress?.unlockedNodeIds).toContain("mossy-bridge");
    expect(attuned.progress?.wonderdex.mossmew).toBe("attuned");
    expect(attuned.currentObjective.targetNodeId).toBe("mossy-bridge");
  });

  it("blocks Mood Trial start when the provided nodeId does not match the current node", () => {
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: createProgress(), mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );

    const blocked = applyWonderAcademyAction(atClearing, {
      type: "startMoodTrial",
      nodeId: "academy-gate",
    });

    expect(blocked.mode).toBe("regionMap");
    expect(blocked.moodTrial).toBeNull();
    expect(blocked.message).toContain("目前位置");
  });

  it("requires tiny-flash before Attune can complete after comfort and snack", () => {
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: createProgress(), mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );
    const started = applyWonderAcademyAction(atClearing, { type: "startMoodTrial" });
    const comforted = applyWonderAcademyAction(started, { type: "comfort" });
    const snacked = applyWonderAcademyAction(comforted, {
      type: "snack",
      snackId: "starberry-cookie",
    });
    const tooSoon = applyWonderAcademyAction(snacked, { type: "attune" });
    const skilled = applyWonderAcademyAction(tooSoon, {
      type: "skill",
      skillId: "tiny-flash",
    });
    const attuned = applyWonderAcademyAction(skilled, { type: "attune" });

    expect(tooSoon.progress?.completedNodeIds).not.toContain("firefly-clearing");
    expect(tooSoon.progress?.wonderdex.mossmew).not.toBe("attuned");
    expect(tooSoon.message).toContain("Tiny Flash");
    expect(attuned.progress?.completedNodeIds).toContain("firefly-clearing");
    expect(attuned.progress?.wonderdex.mossmew).toBe("attuned");
  });

  it("clears ready Mood Trial state when starting a new game", () => {
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: createProgress(), mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );
    const started = applyWonderAcademyAction(atClearing, { type: "startMoodTrial" });
    const comforted = applyWonderAcademyAction(started, { type: "comfort" });
    const ready = applyWonderAcademyAction(comforted, {
      type: "skill",
      skillId: "tiny-flash",
    });
    const newGame = applyWonderAcademyAction(
      { ...ready, isPaused: true },
      {
        type: "newGame",
        userId: "keeper-2",
        starterSpeciesId: "momo",
        now: "2026-06-22T01:00:00.000Z",
      },
    );
    const attemptedAttune = applyWonderAcademyAction(newGame, { type: "attune" });

    expect(newGame.mode).toBe("hub");
    expect(newGame.isPaused).toBe(false);
    expect(newGame.paused).toBe(false);
    expect(newGame.currentNodeId).toBe("academy-gate");
    expect(newGame.progress?.storyProgress.currentNodeId).toBe("academy-gate");
    expect(newGame.trial).toBeNull();
    expect(newGame.moodTrial).toBeNull();
    expect(attemptedAttune.progress?.completedNodeIds).not.toContain("firefly-clearing");
    expect(attemptedAttune.completedNodeIds).not.toContain("firefly-clearing");
    expect(attemptedAttune.progress?.unlockedNodeIds).not.toContain("mossy-bridge");
    expect(attemptedAttune.progress?.wonderdex.mossmew).not.toBe("attuned");
  });

  it("does not allow Attune before Mossmew is ready", () => {
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: createProgress(), mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );
    const started = applyWonderAcademyAction(atClearing, { type: "startMoodTrial" });
    const tooSoon = applyWonderAcademyAction(started, { type: "attune" });

    expect(tooSoon.progress?.completedNodeIds).not.toContain("firefly-clearing");
    expect(tooSoon.progress?.wonderdex.mossmew).not.toBe("attuned");
    expect(tooSoon.message).toContain("先讓 Mossmew 放鬆");
  });

  it("does not auto-unlock arbitrary current objective targets during normalization", () => {
    const progress = {
      ...createProgress(),
      storyProgress: {
        currentChapterId: "sparkleaf-grove",
        currentNodeId: "snack-stump",
        currentObjectiveId: "prepare-berry-snack",
      },
      unlockedNodeIds: ["academy-gate", "firefly-clearing", "mossy-bridge", "snack-stump"],
      completedNodeIds: ["academy-gate", "firefly-clearing", "mossy-bridge", "snack-stump"],
    };

    const state = createInitialWonderAcademyState({ progress, mode: "regionMap" });

    expect(state.currentObjective.targetNodeId).toBe("sparkleaf-warden");
    expect(state.progress?.unlockedNodeIds).not.toContain("sparkleaf-warden");
    expect(selectAdjacentNodeIds(state)).not.toContain("sparkleaf-warden");
  });
});

describe("Wonder Academy progress projection", () => {
  it("projects movement state to progress without mutating previous progress", () => {
    const previous = createProgress();
    const previousSnapshot = structuredClone(previous);
    const moved = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: previous, mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );

    const projected = projectWonderAcademyProgress(
      previous,
      moved,
      "2026-06-22T02:00:00.000Z",
    );

    expect(projected).not.toBe(previous);
    expect(previous).toEqual(previousSnapshot);
    expect(projected.updatedAt).toBe("2026-06-22T02:00:00.000Z");
    expect(projected.storyProgress).toEqual({
      currentChapterId: "sparkleaf-grove",
      currentNodeId: "firefly-clearing",
      currentObjectiveId: "comfort-mossmew",
    });
    expect(projected.unlockedNodeIds).toEqual(["academy-gate", "firefly-clearing"]);
    expect(projected.completedNodeIds).toEqual([]);
    expect(projected.lastSafeResumePoint).toBe("regionMap");
  });

  it("projects successful Attune progress fields and next objective", () => {
    const previous = createProgress();
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: previous, mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );
    const started = applyWonderAcademyAction(atClearing, { type: "startMoodTrial" });
    const comforted = applyWonderAcademyAction(started, { type: "comfort" });
    const snacked = applyWonderAcademyAction(comforted, {
      type: "snack",
      snackId: "starberry-cookie",
    });
    const skilled = applyWonderAcademyAction(snacked, {
      type: "skill",
      skillId: "tiny-flash",
    });
    const attuned = applyWonderAcademyAction(skilled, { type: "attune" });

    const projected = projectWonderAcademyProgress(
      previous,
      attuned,
      "2026-06-22T02:15:00.000Z",
    );

    expect(projected.completedNodeIds).toContain("firefly-clearing");
    expect(projected.unlockedNodeIds).toContain("mossy-bridge");
    expect(projected.wonderdex.mossmew).toBe("attuned");
    expect(projected.storyProgress.currentObjectiveId).toBe("repair-mossy-bridge");
    expect(projected.lastSafeResumePoint).toBe("regionMap");
  });

  it("projects active and paused Mood Trial state to a reconstructable map resume point", () => {
    const previous = createProgress();
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: previous, mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );
    const started = applyWonderAcademyAction(atClearing, { type: "startMoodTrial" });
    const paused = applyWonderAcademyAction(started, { type: "togglePause" });

    const activeProjected = projectWonderAcademyProgress(
      previous,
      started,
      "2026-06-22T02:20:00.000Z",
    );
    const pausedProjected = projectWonderAcademyProgress(
      previous,
      paused,
      "2026-06-22T02:21:00.000Z",
    );
    const resumed = createInitialWonderAcademyState({ progress: pausedProjected });

    expect(started.mode).toBe("moodTrial");
    expect(activeProjected.lastSafeResumePoint).toBe("regionMap");
    expect(pausedProjected.lastSafeResumePoint).toBe("regionMap");
    expect(resumed.mode).toBe("regionMap");
    expect(resumed.currentNodeId).toBe("firefly-clearing");
    expect(resumed.moodTrial).toBeNull();
    expect(resumed.trial).toBeNull();
  });

  it("preserves audio settings and unrelated inventory fields during projection", () => {
    const previous = {
      ...createProgress(),
      snacks: {
        "starberry-cookie": 2,
      },
      audioSettings: {
        musicVolume: 0.12,
        sfxVolume: 0.34,
        muted: true,
      },
    };
    const moved = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: previous, mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );

    const projected = projectWonderAcademyProgress(
      previous,
      moved,
      "2026-06-22T02:30:00.000Z",
    );

    expect(projected.audioSettings).toEqual(previous.audioSettings);
    expect(projected.audioSettings).not.toBe(previous.audioSettings);
    expect(projected.snacks).toEqual(previous.snacks);
    expect(projected.snacks).not.toBe(previous.snacks);
  });

  it("falls back to a conservative previous progress clone when state progress is missing", () => {
    const previous = createProgress();
    const stateWithoutProgress = {
      ...createInitialWonderAcademyState({ progress: null }),
      currentChapterId: "sparkleaf-grove",
      currentNodeId: "firefly-clearing",
      completedNodeIds: ["firefly-clearing"],
    };

    const projected = projectWonderAcademyProgress(
      previous,
      stateWithoutProgress,
      "2026-06-22T02:45:00.000Z",
    );

    expect(projected).not.toBe(previous);
    expect(projected.updatedAt).toBe("2026-06-22T02:45:00.000Z");
    expect(projected.storyProgress.currentNodeId).toBe("academy-gate");
    expect(projected.completedNodeIds).toEqual([]);
    expect(projected.storyProgress.currentObjectiveId).toBe("go-firefly-clearing");
  });

  it("falls back to previous progress when reducer state belongs to another user", () => {
    const previous = createProgress();
    const otherProgress = createInitialWonderAcademyProgress({
      userId: "keeper-2",
      now: "2026-06-22T01:00:00.000Z",
    });
    const movedOtherState = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: otherProgress, mode: "regionMap" }),
      {
        type: "moveToNode",
        nodeId: "firefly-clearing",
      },
    );

    const projected = projectWonderAcademyProgress(
      previous,
      movedOtherState,
      "2026-06-22T03:00:00.000Z",
    );

    expect(projected.userId).toBe("keeper-1");
    expect(projected.storyProgress.currentNodeId).toBe("academy-gate");
    expect(projected.completedNodeIds).toEqual([]);
    expect(projected.updatedAt).toBe("2026-06-22T03:00:00.000Z");
  });
});
