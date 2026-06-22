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
    expect(state.progress?.storyProgress.currentNodeId).toBe("academy-gate");
    expect(state.currentObjective.targetNodeId).toBe("firefly-clearing");
  });

  it("selects only adjacent unlocked map nodes from the academy gate", () => {
    const state = createInitialWonderAcademyState({ progress: createProgress() });

    expect(selectAdjacentNodeIds(state)).toEqual(["firefly-clearing"]);
  });

  it("moves to an adjacent unlocked node and stays in map flow", () => {
    const state = createInitialWonderAcademyState({ progress: createProgress(), mode: "map" });

    const nextState = applyWonderAcademyAction(state, {
      type: "move-to-node",
      nodeId: "firefly-clearing",
    });

    expect(nextState.mode).toBe("map");
    expect(nextState.progress?.storyProgress.currentNodeId).toBe("firefly-clearing");
    expect(nextState.currentObjective.id).toBe("comfort-mossmew");
  });

  it("blocks movement to a non-adjacent locked node", () => {
    const state = createInitialWonderAcademyState({ progress: createProgress(), mode: "map" });

    const nextState = applyWonderAcademyAction(state, {
      type: "move-to-node",
      nodeId: "sparkleaf-warden",
    });

    expect(nextState.progress?.storyProgress.currentNodeId).toBe("academy-gate");
    expect(nextState.message).toContain("還不能前往");
  });

  it("toggles pause without changing the current objective and blocks gameplay while paused", () => {
    const state = createInitialWonderAcademyState({ progress: createProgress(), mode: "map" });
    const pausedState = applyWonderAcademyAction(state, { type: "toggle-pause" });
    const movedWhilePaused = applyWonderAcademyAction(pausedState, {
      type: "move-to-node",
      nodeId: "firefly-clearing",
    });
    const trialWhilePaused = applyWonderAcademyAction(pausedState, {
      type: "mood-trial",
      move: "comfort",
    });
    const unpausedState = applyWonderAcademyAction(pausedState, { type: "toggle-pause" });

    expect(pausedState.isPaused).toBe(true);
    expect(pausedState.currentObjective).toEqual(state.currentObjective);
    expect(movedWhilePaused.progress?.storyProgress.currentNodeId).toBe("academy-gate");
    expect(movedWhilePaused.currentObjective).toEqual(state.currentObjective);
    expect(trialWhilePaused.trial).toEqual(pausedState.trial);
    expect(trialWhilePaused.currentObjective).toEqual(state.currentObjective);
    expect(unpausedState.isPaused).toBe(false);
    expect(unpausedState.currentObjective).toEqual(state.currentObjective);
  });

  it("completes the first Mood Trial after comfort, snack, and a matching skill open Mossmew", () => {
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: createProgress(), mode: "map" }),
      {
        type: "move-to-node",
        nodeId: "firefly-clearing",
      },
    );
    const started = applyWonderAcademyAction(atClearing, { type: "start-mood-trial" });
    const comforted = applyWonderAcademyAction(started, {
      type: "mood-trial",
      move: "comfort",
    });
    const snacked = applyWonderAcademyAction(comforted, {
      type: "mood-trial",
      move: "snack",
      snackId: "starberry-cookie",
    });
    const skilled = applyWonderAcademyAction(snacked, {
      type: "mood-trial",
      move: "skill",
      skillId: "tiny-flash",
    });
    const attuned = applyWonderAcademyAction(skilled, {
      type: "mood-trial",
      move: "attune",
    });

    expect(started.mode).toBe("trial");
    expect(skilled.trial?.opponentDisposition).toBe("open");
    expect(skilled.trial?.mood).toBe("calm");
    expect(attuned.mode).toBe("map");
    expect(attuned.progress?.completedNodeIds).toContain("firefly-clearing");
    expect(attuned.progress?.unlockedNodeIds).toContain("mossy-bridge");
    expect(attuned.progress?.wonderdex.mossmew).toBe("attuned");
    expect(attuned.currentObjective.targetNodeId).toBe("mossy-bridge");
  });

  it("does not allow Attune before Mossmew is ready", () => {
    const atClearing = applyWonderAcademyAction(
      createInitialWonderAcademyState({ progress: createProgress(), mode: "map" }),
      {
        type: "move-to-node",
        nodeId: "firefly-clearing",
      },
    );
    const started = applyWonderAcademyAction(atClearing, { type: "start-mood-trial" });
    const tooSoon = applyWonderAcademyAction(started, {
      type: "mood-trial",
      move: "attune",
    });

    expect(tooSoon.progress?.completedNodeIds).not.toContain("firefly-clearing");
    expect(tooSoon.progress?.wonderdex.mossmew).not.toBe("attuned");
    expect(tooSoon.message).toContain("先讓 Mossmew 放鬆");
  });
});
