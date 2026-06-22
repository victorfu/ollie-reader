import { getCurrentObjective, getNodeById } from "../../../data/wonderAcademyData";
import { createInitialWonderAcademyProgress } from "../../../services/wonderAcademyProgressService";
import type {
  WonderAcademyObjective,
  WonderAcademyProgress,
} from "../../../types/wonderAcademy";

export type WonderAcademyMode = "title" | "hub" | "map" | "trial";

export type WonderAcademyTrialMove = "comfort" | "skill" | "snack" | "attune";

export type WonderAcademyMoodTrialState = {
  opponentSpeciesId: "mossmew";
  mood: "nervous" | "softening" | "calm";
  opponentDisposition: "guarded" | "curious" | "open";
  usedComfort: boolean;
  usedSnack: boolean;
  usedSkillIds: string[];
};

export type CreateInitialWonderAcademyStateOptions = {
  progress: WonderAcademyProgress | null;
  mode?: WonderAcademyMode;
};

export type WonderAcademyState = {
  mode: WonderAcademyMode;
  progress: WonderAcademyProgress | null;
  currentObjective: WonderAcademyObjective;
  isPaused: boolean;
  message: string | null;
  trial: WonderAcademyMoodTrialState | null;
};

export type WonderAcademyAction =
  | {
      type: "choose-starter";
      userId: string;
      starterSpeciesId: string;
      starterNickname?: string;
      playerName?: string | null;
      now: string;
    }
  | { type: "toggle-pause" }
  | { type: "move-to-node"; nodeId: string }
  | { type: "start-mood-trial" }
  | { type: "mood-trial"; move: "comfort" }
  | { type: "mood-trial"; move: "skill"; skillId: string }
  | { type: "mood-trial"; move: "snack"; snackId?: string }
  | { type: "mood-trial"; move: "attune" };

const STARTER_OBJECTIVE: WonderAcademyObjective = {
  id: "choose-first-wonderling",
  label: "選擇你的第一位 Wonderling 夥伴",
  description: "選擇 starter Wonderling，準備進入 Wonder Academy。",
  targetChapterId: "sparkleaf-grove",
  targetNodeId: "academy-gate",
};

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function getObjectiveForProgress(progress: WonderAcademyProgress | null): WonderAcademyObjective {
  if (!progress) {
    return STARTER_OBJECTIVE;
  }

  return getCurrentObjective({
    currentChapterId: progress.storyProgress.currentChapterId,
    currentNodeId: progress.storyProgress.currentNodeId,
    completedNodeIds: progress.completedNodeIds,
  });
}

function normalizeProgress(progress: WonderAcademyProgress): WonderAcademyProgress {
  const currentObjective = getObjectiveForProgress(progress);
  const unlockedNodeIds = uniqueValues([
    ...progress.unlockedNodeIds,
    progress.storyProgress.currentNodeId,
    currentObjective.targetNodeId,
  ]);

  return {
    ...progress,
    storyProgress: {
      ...progress.storyProgress,
      currentObjectiveId: currentObjective.id,
    },
    unlockedNodeIds,
    completedNodeIds: [...progress.completedNodeIds],
    completedQuestIds: [...progress.completedQuestIds],
    ownedWonderlings: progress.ownedWonderlings.map((wonderling) => ({
      ...wonderling,
      equippedSkillIds: [...wonderling.equippedSkillIds],
      unlockedSkillIds: [...wonderling.unlockedSkillIds],
    })),
    wonderdex: { ...progress.wonderdex },
    keeperTeam: {
      activeOwnedId: progress.keeperTeam.activeOwnedId,
      supportOwnedIds: [...progress.keeperTeam.supportOwnedIds],
      reserveOwnedIds: [...progress.keeperTeam.reserveOwnedIds],
    },
    skillLoadouts: Object.fromEntries(
      Object.entries(progress.skillLoadouts).map(([ownedId, skillIds]) => [
        ownedId,
        [...skillIds],
      ]),
    ),
    snacks: { ...progress.snacks },
    charms: { ...progress.charms },
    careerLevels: { ...progress.careerLevels },
    audioSettings: { ...progress.audioSettings },
    accessibilitySettings: { ...progress.accessibilitySettings },
  };
}

function withProgress(state: WonderAcademyState, progress: WonderAcademyProgress): WonderAcademyState {
  const normalizedProgress = normalizeProgress(progress);

  return {
    ...state,
    progress: normalizedProgress,
    currentObjective: getObjectiveForProgress(normalizedProgress),
  };
}

function blockIfPaused(state: WonderAcademyState): WonderAcademyState | null {
  return state.isPaused ? { ...state, message: "遊戲已暫停，先解除暫停再繼續。" } : null;
}

export function createInitialWonderAcademyState({
  progress,
  mode,
}: CreateInitialWonderAcademyStateOptions): WonderAcademyState {
  const normalizedProgress = progress ? normalizeProgress(progress) : null;

  return {
    mode: mode ?? (normalizedProgress ? "hub" : "title"),
    progress: normalizedProgress,
    currentObjective: getObjectiveForProgress(normalizedProgress),
    isPaused: false,
    message: null,
    trial: null,
  };
}

export function selectAdjacentNodeIds(state: WonderAcademyState): string[] {
  const progress = state.progress;
  if (!progress) {
    return [];
  }

  const currentNode = getNodeById(
    progress.storyProgress.currentChapterId,
    progress.storyProgress.currentNodeId,
  );
  if (!currentNode) {
    return [];
  }

  return currentNode.adjacentNodeIds.filter((nodeId) => progress.unlockedNodeIds.includes(nodeId));
}

export function applyWonderAcademyAction(
  state: WonderAcademyState,
  action: WonderAcademyAction,
): WonderAcademyState {
  if (action.type === "toggle-pause") {
    return { ...state, isPaused: !state.isPaused, message: null };
  }

  const pausedState = blockIfPaused(state);
  if (pausedState) {
    return pausedState;
  }

  switch (action.type) {
    case "choose-starter": {
      const progress = createInitialWonderAcademyProgress({
        userId: action.userId,
        starterSpeciesId: action.starterSpeciesId,
        starterNickname: action.starterNickname,
        playerName: action.playerName ?? null,
        now: action.now,
      });

      return {
        ...withProgress(state, progress),
        mode: "hub",
        message: "Wonder Academy 夥伴已加入隊伍。",
      };
    }

    case "move-to-node":
      return moveToNode(state, action.nodeId);

    case "start-mood-trial":
      return startMoodTrial(state);

    case "mood-trial":
      return applyMoodTrialMove(state, action);
  }
}

function moveToNode(state: WonderAcademyState, nodeId: string): WonderAcademyState {
  const progress = state.progress;
  if (!progress) {
    return { ...state, message: "請先選擇你的第一位 Wonderling 夥伴。" };
  }

  const currentNode = getNodeById(
    progress.storyProgress.currentChapterId,
    progress.storyProgress.currentNodeId,
  );
  const targetNode = getNodeById(progress.storyProgress.currentChapterId, nodeId);
  const isAdjacent = currentNode?.adjacentNodeIds.includes(nodeId) ?? false;
  const isUnlocked = progress.unlockedNodeIds.includes(nodeId);

  if (!targetNode || !isAdjacent || !isUnlocked) {
    return {
      ...state,
      message: "還不能前往這個地點。請選擇相鄰且已解鎖的節點。",
    };
  }

  return withProgress(
    {
      ...state,
      mode: state.mode === "hub" ? "map" : state.mode,
      message: `${targetNode.label} 已抵達。`,
      trial: null,
    },
    {
      ...progress,
      storyProgress: {
        ...progress.storyProgress,
        currentNodeId: targetNode.id,
      },
    },
  );
}

function startMoodTrial(state: WonderAcademyState): WonderAcademyState {
  const progress = state.progress;
  if (!progress || progress.storyProgress.currentNodeId !== "firefly-clearing") {
    return { ...state, message: "這裡目前沒有可開始的 Mood Trial。" };
  }

  return {
    ...state,
    mode: "trial",
    message: "Mossmew 正緊張地看著你。",
    trial: {
      opponentSpeciesId: "mossmew",
      mood: "nervous",
      opponentDisposition: "guarded",
      usedComfort: false,
      usedSnack: false,
      usedSkillIds: [],
    },
  };
}

function applyMoodTrialMove(
  state: WonderAcademyState,
  action: Extract<WonderAcademyAction, { type: "mood-trial" }>,
): WonderAcademyState {
  if (!state.trial) {
    return { ...state, message: "請先開始 Mood Trial。" };
  }

  switch (action.move) {
    case "comfort":
      return {
        ...state,
        message: "你放低聲音安撫 Mossmew，牠慢慢靠近。",
        trial: {
          ...state.trial,
          usedComfort: true,
          mood: "softening",
          opponentDisposition: "curious",
        },
      };

    case "snack":
      return {
        ...state,
        message: "Mossmew 接過小點心，緊張感少了一些。",
        trial: {
          ...state.trial,
          usedSnack: true,
          mood: state.trial.usedComfort ? "calm" : "softening",
          opponentDisposition: state.trial.usedComfort ? "open" : "curious",
        },
      };

    case "skill":
      return applyMoodTrialSkill(state, action.skillId);

    case "attune":
      return attuneMossmew(state);
  }
}

function applyMoodTrialSkill(state: WonderAcademyState, skillId: string): WonderAcademyState {
  const trial = state.trial;
  if (!trial) {
    return state;
  }

  const usedSkillIds = uniqueValues([...trial.usedSkillIds, skillId]);
  const isOpeningSkill = skillId === "tiny-flash";
  const ready = trial.usedComfort && isOpeningSkill;

  return {
    ...state,
    message: ready
      ? "Tiny Flash 像螢火一樣亮起，Mossmew 放鬆地點點頭。"
      : "這個技能還沒讓 Mossmew 完全放鬆。",
    trial: {
      ...trial,
      usedSkillIds,
      mood: ready ? "calm" : trial.mood,
      opponentDisposition: ready ? "open" : trial.opponentDisposition,
    },
  };
}

function attuneMossmew(state: WonderAcademyState): WonderAcademyState {
  const progress = state.progress;
  const trial = state.trial;
  const ready = trial?.mood === "calm" && trial.opponentDisposition === "open";

  if (!progress || !trial || !ready) {
    return {
      ...state,
      message: "先讓 Mossmew 放鬆並願意靠近，再嘗試 Attune。",
    };
  }

  const completedNodeIds = uniqueValues([...progress.completedNodeIds, "firefly-clearing"]);
  const unlockedNodeIds = uniqueValues([...progress.unlockedNodeIds, "mossy-bridge"]);

  return withProgress(
    {
      ...state,
      mode: "map",
      message: "Attune 成功！Mossmew 已記錄在 Wonderdex。",
      trial: null,
    },
    {
      ...progress,
      completedNodeIds,
      unlockedNodeIds,
      wonderdex: {
        ...progress.wonderdex,
        mossmew: "attuned",
      },
    },
  );
}
