import { describe, expect, it } from "vitest";
import { createInitialWonderAcademyProgress } from "../../../services/wonderAcademyProgressService";
import {
  applyWonderAcademyAction,
  createInitialWonderAcademyState,
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
