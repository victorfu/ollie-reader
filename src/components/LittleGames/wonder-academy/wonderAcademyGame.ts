import kaplay, { type GameObj, type KAPLAYCtx, type TextComp } from "kaplay";
import { getChapterById, getNodeById } from "../../../data/wonderAcademyData";
import type { WonderAcademyMapNode } from "../../../types/wonderAcademy";
import { startKaplaySceneWhenReady } from "../monster-academy/kaplayLifecycle";
import {
  selectAdjacentNodeIds,
  type WonderAcademyAction,
  type WonderAcademyState,
} from "./wonderAcademyLogic";

export const WONDER_ACADEMY_WIDTH = 1280;
export const WONDER_ACADEMY_HEIGHT = 800;

export type WonderAcademyAssets = {
  academyHub: string;
  sparkleafMap: string;
  moodTrial: string;
  lumiPortrait: string;
  momoPortrait: string;
  picoPortrait: string;
  nibiPortrait: string;
  mossmewPortrait: string;
  sparkleafFawnPortrait: string;
};

export type WonderAcademyGameController = {
  dispatch(action: WonderAcademyAction): void;
  updateState(state: WonderAcademyState): void;
  quit(): void;
};

export type CreateWonderAcademyGameOptions = {
  canvas: HTMLCanvasElement;
  assets: WonderAcademyAssets;
  state: WonderAcademyState;
  onAction: (action: WonderAcademyAction) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type FloatingObject = {
  obj: GameObj;
  baseY: number;
  speed: number;
  amplitude: number;
};

type ObjectiveHudLayout = {
  objectiveRect: Rect;
  messageRect?: Rect;
};

type MapNodeVisualState =
  | "current"
  | "adjacent"
  | "completed"
  | "objective"
  | "locked"
  | "unlocked";

const DYNAMIC_TAG = "wonder-academy-dynamic";
const CHAPTER_ID = "sparkleaf-grove";
const HUB_OPEN_MAP_BUTTON: Rect = { x: 840, y: 606, width: 300, height: 82 };
const HUB_PAUSE_BUTTON: Rect = { x: 1056, y: 38, width: 164, height: 58 };
const RETURN_HUB_BUTTON: Rect = { x: 44, y: 40, width: 146, height: 54 };
const MAP_TRIAL_BUTTON: Rect = { x: 930, y: 660, width: 270, height: 70 };
const PAUSE_RESUME_BUTTON: Rect = { x: 508, y: 438, width: 264, height: 76 };
const HUB_OBJECTIVE_LAYOUT: ObjectiveHudLayout = {
  objectiveRect: { x: 42, y: 28, width: 676, height: 118 },
  messageRect: { x: 370, y: 674, width: 540, height: 64 },
};
const MAP_OBJECTIVE_LAYOUT: ObjectiveHudLayout = {
  objectiveRect: { x: 216, y: 28, width: 650, height: 118 },
  messageRect: { x: 78, y: 666, width: 620, height: 64 },
};
const TRIAL_OBJECTIVE_LAYOUT: ObjectiveHudLayout = {
  objectiveRect: { x: 216, y: 28, width: 650, height: 118 },
  messageRect: { x: 370, y: 560, width: 540, height: 64 },
};
const TRIAL_BUTTONS: Record<
  "comfort" | "skill" | "snack" | "attune",
  Rect & { label: string; hint: string }
> = {
  comfort: {
    x: 84,
    y: 650,
    width: 250,
    height: 82,
    label: "Comfort",
    hint: "lower your voice",
  },
  skill: {
    x: 372,
    y: 650,
    width: 250,
    height: 82,
    label: "Tiny Flash",
    hint: "show a gentle spark",
  },
  snack: {
    x: 660,
    y: 650,
    width: 250,
    height: 82,
    label: "Snack",
    hint: "offer starberry",
  },
  attune: {
    x: 948,
    y: 650,
    width: 250,
    height: 82,
    label: "Attune",
    hint: "bond when ready",
  },
};
const STARTER_SPRITES: Record<string, keyof WonderAcademyAssets> = {
  lumi: "lumiPortrait",
  momo: "momoPortrait",
  pico: "picoPortrait",
  nibi: "nibiPortrait",
};
const NODE_RADIUS = 34;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isInside(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

function isInsideCircle(center: Point, radius: number, x: number, y: number): boolean {
  const dx = x - center.x;
  const dy = y - center.y;

  return dx * dx + dy * dy <= radius * radius;
}

function addBackdrop(k: KAPLAYCtx, sprite: keyof WonderAcademyAssets): void {
  k.add([
    k.sprite(sprite, {
      width: WONDER_ACADEMY_WIDTH,
      height: WONDER_ACADEMY_HEIGHT,
    }),
    k.pos(0, 0),
    k.z(0),
    DYNAMIC_TAG,
  ]);
}

function addShade(k: KAPLAYCtx, opacity = 0.16): void {
  k.add([
    k.rect(WONDER_ACADEMY_WIDTH, WONDER_ACADEMY_HEIGHT),
    k.pos(0, 0),
    k.color("#102033"),
    k.opacity(opacity),
    k.z(4),
    DYNAMIC_TAG,
  ]);
}

function addPanel(
  k: KAPLAYCtx,
  rect: Rect,
  options: {
    color?: string;
    opacity?: number;
    outline?: string;
    radius?: number;
    z?: number;
  } = {},
): void {
  k.add([
    k.rect(rect.width, rect.height, { radius: options.radius ?? 22 }),
    k.pos(rect.x, rect.y),
    k.color(options.color ?? "#f8fbff"),
    k.opacity(options.opacity ?? 0.84),
    k.outline(2, k.rgb(options.outline ?? "#ffffff"), 0.58),
    k.z(options.z ?? 40),
    DYNAMIC_TAG,
  ]);
}

function addText(
  k: KAPLAYCtx,
  value: string,
  x: number,
  y: number,
  options: {
    size?: number;
    width?: number;
    align?: "left" | "center" | "right";
    color?: string;
    z?: number;
  } = {},
): GameObj<TextComp> {
  return k.add([
    k.text(value, {
      size: options.size ?? 24,
      width: options.width,
      align: options.align,
      lineSpacing: 4,
    }),
    k.pos(x, y),
    k.color(options.color ?? "#172033"),
    k.z(options.z ?? 60),
    DYNAMIC_TAG,
  ]);
}

function addButton(
  k: KAPLAYCtx,
  rect: Rect,
  label: string,
  options: {
    hint?: string;
    primary?: boolean;
    disabled?: boolean;
    selected?: boolean;
  } = {},
): void {
  const primary = options.primary && !options.disabled;
  const selected = options.selected && !options.disabled;

  addPanel(k, rect, {
    color: primary ? "#ffe6a8" : selected ? "#eff8ff" : options.disabled ? "#eef2f7" : "#f8fbff",
    opacity: options.disabled ? 0.62 : primary ? 0.95 : 0.86,
    outline: primary ? "#f59e0b" : selected ? "#2e90fa" : "#ffffff",
    z: primary ? 64 : 54,
  });
  addText(k, label, rect.x, rect.y + (options.hint ? 16 : 25), {
    align: "center",
    color: primary ? "#713f12" : options.disabled ? "#667085" : "#172033",
    size: 24,
    width: rect.width,
    z: primary ? 78 : 68,
  });

  if (options.hint) {
    addText(k, options.hint, rect.x + 16, rect.y + 50, {
      align: "center",
      color: options.disabled ? "#98a2b3" : "#667085",
      size: 15,
      width: rect.width - 32,
      z: primary ? 78 : 68,
    });
  }
}

function addPortrait(
  k: KAPLAYCtx,
  sprite: keyof WonderAcademyAssets,
  x: number,
  y: number,
  width: number,
  height: number,
  z = 34,
): GameObj {
  return k.add([
    k.sprite(sprite, { width, height }),
    k.pos(x, y),
    k.anchor("center"),
    k.z(z),
    DYNAMIC_TAG,
  ]);
}

function addLine(k: KAPLAYCtx, from: Point, to: Point, color: string, opacity = 0.72): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  k.add([
    k.rect(length, 8, { radius: 4 }),
    k.pos(from.x + dx / 2, from.y + dy / 2),
    k.anchor("center"),
    k.rotate(angle),
    k.color(color),
    k.opacity(opacity),
    k.z(20),
    DYNAMIC_TAG,
  ]);
}

function getNodePoint(node: WonderAcademyMapNode): Point {
  return {
    x: 108 + node.x * (WONDER_ACADEMY_WIDTH - 216),
    y: 112 + node.y * (WONDER_ACADEMY_HEIGHT - 258),
  };
}

function getNodeClickRect(node: WonderAcademyMapNode): Rect {
  const point = getNodePoint(node);

  return {
    x: point.x - NODE_RADIUS - 14,
    y: point.y - NODE_RADIUS - 14,
    width: (NODE_RADIUS + 14) * 2,
    height: (NODE_RADIUS + 14) * 2,
  };
}

function shortenLabel(label: string): string {
  if (label.length <= 18) return label;

  return `${label.slice(0, 17)}...`;
}

function getNodeVisualState(
  node: WonderAcademyMapNode,
  state: WonderAcademyState,
  adjacentNodeIds: string[],
): MapNodeVisualState {
  const current = node.id === state.currentNodeId;
  const completed = state.completedNodeIds.includes(node.id);
  const objectiveTarget = state.currentObjective.targetNodeId === node.id;
  const unlocked = state.unlockedNodeIds.includes(node.id);
  const adjacent = adjacentNodeIds.includes(node.id);

  if (current) return "current";
  if (completed) return "completed";
  if (objectiveTarget && unlocked) return "objective";
  if (adjacent && unlocked) return "adjacent";
  if (unlocked) return "unlocked";

  return "locked";
}

function getNodeColors(visualState: MapNodeVisualState): {
  fill: string;
  stroke: string;
  text: string;
  label: string;
  opacity: number;
} {
  switch (visualState) {
    case "current":
      return {
        fill: "#fff7ed",
        stroke: "#f59e0b",
        text: "#7a2e0e",
        label: "You",
        opacity: 0.96,
      };
    case "completed":
      return {
        fill: "#ecfdf3",
        stroke: "#12b76a",
        text: "#027a48",
        label: "Done",
        opacity: 0.9,
      };
    case "objective":
      return {
        fill: "#fef3c7",
        stroke: "#f59e0b",
        text: "#7a2e0e",
        label: "Goal",
        opacity: 0.92,
      };
    case "adjacent":
      return {
        fill: "#eff8ff",
        stroke: "#2e90fa",
        text: "#175cd3",
        label: "Go",
        opacity: 0.92,
      };
    case "unlocked":
      return {
        fill: "#f8fbff",
        stroke: "#ffffff",
        text: "#344054",
        label: "Open",
        opacity: 0.82,
      };
    case "locked":
      return {
        fill: "#eef2f7",
        stroke: "#d0d5dd",
        text: "#667085",
        label: "Lock",
        opacity: 0.64,
      };
  }
}

function addObjectiveHud(
  k: KAPLAYCtx,
  state: WonderAcademyState,
  feedback: string | null,
  layout: ObjectiveHudLayout = HUB_OBJECTIVE_LAYOUT,
): void {
  const { objectiveRect, messageRect } = layout;

  addPanel(k, objectiveRect, { opacity: 0.88 });
  addText(k, state.currentObjective.label, objectiveRect.x + 30, objectiveRect.y + 22, {
    size: 26,
    width: objectiveRect.width - 60,
  });
  addText(k, state.currentObjective.description, objectiveRect.x + 30, objectiveRect.y + 60, {
    color: "#475467",
    size: 17,
    width: objectiveRect.width - 70,
  });

  const message = feedback ?? state.message;
  if (message && messageRect) {
    addPanel(k, messageRect, { opacity: 0.9 });
    addText(k, message, messageRect.x + 22, messageRect.y + 18, {
      align: "center",
      color: "#344054",
      size: 17,
      width: messageRect.width - 44,
    });
  }
}

function addPauseButton(k: KAPLAYCtx, state: WonderAcademyState): void {
  if (!state.progress) return;

  addButton(k, HUB_PAUSE_BUTTON, state.paused || state.isPaused ? "Resume" : "Pause", {
    selected: state.paused || state.isPaused,
  });
}

function canStartMoodTrial(state: WonderAcademyState): boolean {
  return (
    Boolean(state.progress) &&
    state.currentNodeId === "firefly-clearing" &&
    !state.completedNodeIds.includes("firefly-clearing")
  );
}

function isPaused(state: WonderAcademyState): boolean {
  return state.paused || state.isPaused;
}

export function createWonderAcademyGame({
  canvas,
  assets,
  state,
  onAction,
  onReady,
  onError,
}: CreateWonderAcademyGameOptions): WonderAcademyGameController {
  const k = kaplay({
    canvas,
    width: WONDER_ACADEMY_WIDTH,
    height: WONDER_ACADEMY_HEIGHT,
    stretch: true,
    letterbox: true,
    global: false,
    debug: false,
    focus: true,
    touchToMouse: false,
    loadingScreen: false,
    background: [18, 32, 34],
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
  });

  k.loadSprite("academyHub", assets.academyHub);
  k.loadSprite("sparkleafMap", assets.sparkleafMap);
  k.loadSprite("moodTrial", assets.moodTrial);
  k.loadSprite("lumiPortrait", assets.lumiPortrait);
  k.loadSprite("momoPortrait", assets.momoPortrait);
  k.loadSprite("picoPortrait", assets.picoPortrait);
  k.loadSprite("nibiPortrait", assets.nibiPortrait);
  k.loadSprite("mossmewPortrait", assets.mossmewPortrait);
  k.loadSprite("sparkleafFawnPortrait", assets.sparkleafFawnPortrait);

  const sceneCleanups = new Set<() => void>();
  const floaters: FloatingObject[] = [];
  let renderState = state;
  let sceneReady = false;
  let feedbackMessage: string | null = null;

  const dispatch = (action: WonderAcademyAction) => {
    feedbackMessage = null;
    onAction(action);
  };

  const setFeedback = (message: string) => {
    feedbackMessage = message;
    render();
  };

  const clearDynamicObjects = () => {
    k.query({ include: DYNAMIC_TAG }).forEach((obj) => {
      if (obj.exists()) {
        k.destroy(obj);
      }
    });
    floaters.length = 0;
  };

  const addFloatingPortrait = (
    sprite: keyof WonderAcademyAssets,
    x: number,
    y: number,
    width: number,
    height: number,
    options: { z?: number; speed?: number; amplitude?: number } = {},
  ) => {
    const obj = addPortrait(k, sprite, x, y, width, height, options.z ?? 34);
    floaters.push({
      obj,
      baseY: y,
      speed: options.speed ?? 1.2,
      amplitude: options.amplitude ?? 5,
    });
  };

  const renderTitleOrHub = () => {
    const hasProgress = Boolean(renderState.progress);
    const starterSprite =
      STARTER_SPRITES[renderState.progress?.starterSpeciesId ?? "lumi"] ?? "lumiPortrait";

    addBackdrop(k, "academyHub");
    addShade(k, hasProgress ? 0.08 : 0.18);
    addPanel(k, { x: 86, y: 150, width: 526, height: 368 }, { opacity: 0.9 });
    addText(k, "Wonder Academy", 124, 190, {
      size: 40,
      width: 450,
    });
    addText(
      k,
      hasProgress
        ? "Your Wonderling team is ready. Open Sparkleaf Grove and follow the glowing trail."
        : "Choose a starter in the page controls to begin your first academy adventure.",
      126,
      252,
      {
        color: "#475467",
        size: 21,
        width: 420,
      },
    );

    if (hasProgress) {
      addFloatingPortrait(starterSprite, 288, 448, 150, 150, {
        z: 46,
        speed: 1.4,
        amplitude: 6,
      });
      addText(k, renderState.progress?.starterNickname ?? "Starter", 374, 390, {
        size: 24,
        width: 176,
      });
      addText(k, "Partner ready", 374, 426, {
        color: "#667085",
        size: 17,
        width: 176,
      });
      addButton(k, HUB_OPEN_MAP_BUTTON, "Open Map", {
        hint: "Sparkleaf Grove",
        primary: true,
      });
    }

    addPauseButton(k, renderState);
    addObjectiveHud(k, renderState, feedbackMessage, HUB_OBJECTIVE_LAYOUT);
  };

  const renderMapConnections = (nodes: WonderAcademyMapNode[]) => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const completedNodeIds = new Set(renderState.completedNodeIds);
    const unlockedNodeIds = new Set(renderState.unlockedNodeIds);

    nodes.forEach((node) => {
      node.adjacentNodeIds.forEach((adjacentNodeId) => {
        if (node.id > adjacentNodeId) return;

        const adjacentNode = nodeById.get(adjacentNodeId);
        if (!adjacentNode) return;

        const active =
          (node.id === renderState.currentNodeId && unlockedNodeIds.has(adjacentNode.id)) ||
          (adjacentNode.id === renderState.currentNodeId && unlockedNodeIds.has(node.id)) ||
          (completedNodeIds.has(node.id) && completedNodeIds.has(adjacentNode.id));

        addLine(
          k,
          getNodePoint(node),
          getNodePoint(adjacentNode),
          active ? "#7dd3fc" : "#ffffff",
          active ? 0.86 : 0.42,
        );
      });
    });
  };

  const renderMapNode = (
    node: WonderAcademyMapNode,
    visualState: MapNodeVisualState,
  ) => {
    const point = getNodePoint(node);
    const colors = getNodeColors(visualState);

    k.add([
      k.circle(NODE_RADIUS),
      k.pos(point.x, point.y),
      k.anchor("center"),
      k.color(colors.fill),
      k.opacity(colors.opacity),
      k.outline(4, k.rgb(colors.stroke), visualState === "locked" ? 0.72 : 0.96),
      k.z(44),
      DYNAMIC_TAG,
    ]);
    addText(k, colors.label, point.x - NODE_RADIUS, point.y - 11, {
      align: "center",
      color: colors.text,
      size: colors.label === "Lock" ? 16 : 19,
      width: NODE_RADIUS * 2,
      z: 62,
    });
    addPanel(
      k,
      {
        x: clamp(point.x - 90, 22, WONDER_ACADEMY_WIDTH - 206),
        y: clamp(point.y + 42, 42, WONDER_ACADEMY_HEIGHT - 104),
        width: 180,
        height: 46,
      },
      {
        color: "#f8fbff",
        opacity: visualState === "locked" ? 0.66 : 0.86,
        radius: 12,
        z: 34,
      },
    );
    addText(
      k,
      shortenLabel(node.label),
      clamp(point.x - 82, 30, WONDER_ACADEMY_WIDTH - 198),
      clamp(point.y + 55, 55, WONDER_ACADEMY_HEIGHT - 91),
      {
        align: "center",
        color: visualState === "locked" ? "#667085" : "#172033",
        size: 15,
        width: 164,
        z: 66,
      },
    );
  };

  const renderRegionMap = () => {
    const chapter = getChapterById(CHAPTER_ID);
    const adjacentNodeIds = selectAdjacentNodeIds(renderState);
    const adjacentSet = new Set(adjacentNodeIds);
    const currentNode = getNodeById(renderState.currentChapterId, renderState.currentNodeId);

    addBackdrop(k, "sparkleafMap");
    addShade(k, 0.1);
    addButton(k, RETURN_HUB_BUTTON, "Hub");
    addPauseButton(k, renderState);

    if (chapter) {
      renderMapConnections(chapter.nodes);
      chapter.nodes.forEach((node) => {
        renderMapNode(node, getNodeVisualState(node, renderState, adjacentNodeIds));
      });
    }

    addPanel(k, { x: 768, y: 530, width: 454, height: 206 }, { opacity: 0.9 });
    addText(k, currentNode?.label ?? "Sparkleaf Grove", 800, 556, {
      size: 27,
      width: 360,
    });
    addText(
      k,
      adjacentNodeIds.length > 0
        ? "Blue nodes are reachable from here. Locked paths need story progress or field skills."
        : "No adjacent unlocked paths yet. Follow the current objective.",
      800,
      596,
      {
        color: "#475467",
        size: 17,
        width: 370,
      },
    );
    addButton(k, MAP_TRIAL_BUTTON, canStartMoodTrial(renderState) ? "Start Mood Trial" : "Mood Trial Locked", {
      disabled: !canStartMoodTrial(renderState),
      primary: canStartMoodTrial(renderState),
    });

    if (adjacentSet.size > 0) {
      addText(k, "Click a blue node to travel.", 802, 706, {
        color: "#667085",
        size: 15,
        width: 270,
      });
    }

    addObjectiveHud(k, renderState, feedbackMessage, MAP_OBJECTIVE_LAYOUT);
  };

  const renderMoodTrial = () => {
    const trial = renderState.moodTrial ?? renderState.trial;

    addBackdrop(k, "moodTrial");
    addShade(k, 0.08);
    addButton(k, RETURN_HUB_BUTTON, "Hub");
    addPauseButton(k, renderState);
    addFloatingPortrait("mossmewPortrait", 870, 404, 260, 260, {
      z: 34,
      speed: 1.1,
      amplitude: 4,
    });
    addFloatingPortrait(
      STARTER_SPRITES[renderState.progress?.starterSpeciesId ?? "lumi"] ?? "lumiPortrait",
      308,
      468,
      170,
      170,
      {
        z: 36,
        speed: 1.35,
        amplitude: 5,
      },
    );

    addPanel(k, { x: 70, y: 178, width: 470, height: 218 }, { opacity: 0.9 });
    addText(k, "Mossmew Mood Trial", 104, 208, {
      size: 31,
      width: 390,
    });
    addText(k, trial ? `Mood: ${trial.mood}` : "Mood: not started", 106, 264, {
      color: "#344054",
      size: 22,
      width: 360,
    });
    addText(
      k,
      trial ? `Disposition: ${trial.opponentDisposition}` : "Approach gently to begin.",
      106,
      306,
      {
        color: "#475467",
        size: 20,
        width: 360,
      },
    );
    addText(
      k,
      trial
        ? `Comfort ${trial.usedComfort ? "yes" : "no"}  Snack ${
            trial.usedSnack ? "yes" : "no"
          }  Tiny Flash ${trial.usedSkillIds.includes("tiny-flash") ? "yes" : "no"}`
        : "Use comfort, a gentle skill, and a snack before Attune.",
      106,
      350,
      {
        color: "#667085",
        size: 16,
        width: 380,
      },
    );

    addPanel(k, { x: 700, y: 188, width: 372, height: 86 }, { opacity: 0.86 });
    addText(k, "Mossmew", 730, 210, {
      size: 28,
      width: 300,
    });
    addText(k, "Lost, guarded, listening.", 730, 250, {
      color: "#667085",
      size: 16,
      width: 300,
    });

    addButton(k, TRIAL_BUTTONS.comfort, "Comfort", {
      hint: TRIAL_BUTTONS.comfort.hint,
      disabled: !trial,
    });
    addButton(k, TRIAL_BUTTONS.skill, "Tiny Flash", {
      hint: TRIAL_BUTTONS.skill.hint,
      disabled: !trial,
    });
    addButton(k, TRIAL_BUTTONS.snack, "Snack", {
      hint: TRIAL_BUTTONS.snack.hint,
      disabled: !trial,
    });
    addButton(k, TRIAL_BUTTONS.attune, "Attune", {
      hint: TRIAL_BUTTONS.attune.hint,
      disabled: !trial,
      primary: true,
    });
    addObjectiveHud(k, renderState, feedbackMessage, TRIAL_OBJECTIVE_LAYOUT);
  };

  const renderPauseOverlay = () => {
    if (!isPaused(renderState)) return;

    k.add([
      k.rect(WONDER_ACADEMY_WIDTH, WONDER_ACADEMY_HEIGHT),
      k.pos(0, 0),
      k.color("#0b1220"),
      k.opacity(0.52),
      k.z(180),
      DYNAMIC_TAG,
    ]);
    addPanel(k, { x: 430, y: 292, width: 420, height: 236 }, {
      color: "#f8fbff",
      opacity: 0.94,
      z: 190,
    });
    addText(k, "Paused", 470, 328, {
      align: "center",
      size: 38,
      width: 340,
      z: 210,
    });
    addText(k, "Resume when you are ready.", 470, 386, {
      align: "center",
      color: "#667085",
      size: 18,
      width: 340,
      z: 210,
    });
    addButton(k, PAUSE_RESUME_BUTTON, "Resume", {
      primary: true,
    });
  };

  function render() {
    if (!sceneReady) return;

    clearDynamicObjects();

    if (renderState.mode === "regionMap") {
      renderRegionMap();
    } else if (renderState.mode === "moodTrial") {
      renderMoodTrial();
    } else {
      renderTitleOrHub();
    }

    renderPauseOverlay();
  }

  const handleNodePress = (x: number, y: number) => {
    const chapter = getChapterById(CHAPTER_ID);
    if (!chapter) return false;

    const adjacentNodeIds = selectAdjacentNodeIds(renderState);
    const adjacentSet = new Set(adjacentNodeIds);

    const node = chapter.nodes.find((item) => {
      const point = getNodePoint(item);

      return isInsideCircle(point, NODE_RADIUS + 14, x, y) || isInside(getNodeClickRect(item), x, y);
    });

    if (!node) return false;

    if (adjacentSet.has(node.id) && renderState.unlockedNodeIds.includes(node.id)) {
      dispatch({ type: "moveToNode", nodeId: node.id });
      return true;
    }

    if (node.id === renderState.currentNodeId) {
      setFeedback("You are already here.");
      return true;
    }

    setFeedback(
      renderState.unlockedNodeIds.includes(node.id)
        ? "Choose an adjacent blue node from your current location."
        : node.lockedBy?.hint ?? "That path is still locked.",
    );
    return true;
  };

  const handleGamePress = (x: number, y: number) => {
    if (isPaused(renderState)) {
      if (isInside(PAUSE_RESUME_BUTTON, x, y)) {
        dispatch({ type: "togglePause" });
      }
      return;
    }

    if (renderState.progress && isInside(HUB_PAUSE_BUTTON, x, y)) {
      dispatch({ type: "togglePause" });
      return;
    }

    if (renderState.mode === "hub" || renderState.mode === "title") {
      if (renderState.progress && isInside(HUB_OPEN_MAP_BUTTON, x, y)) {
        dispatch({ type: "openRegionMap" });
      }
      return;
    }

    if (isInside(RETURN_HUB_BUTTON, x, y)) {
      dispatch({ type: "returnHub" });
      return;
    }

    if (renderState.mode === "regionMap") {
      if (isInside(MAP_TRIAL_BUTTON, x, y)) {
        if (canStartMoodTrial(renderState)) {
          dispatch({ type: "startMoodTrial", nodeId: renderState.currentNodeId });
        } else {
          setFeedback("Mood Trial begins at Firefly Clearing.");
        }
        return;
      }

      handleNodePress(x, y);
      return;
    }

    if (renderState.mode === "moodTrial") {
      if (isInside(TRIAL_BUTTONS.comfort, x, y)) {
        dispatch({ type: "comfort" });
        return;
      }

      if (isInside(TRIAL_BUTTONS.skill, x, y)) {
        dispatch({ type: "skill", skillId: "tiny-flash" });
        return;
      }

      if (isInside(TRIAL_BUTTONS.snack, x, y)) {
        dispatch({ type: "snack", snackId: "starberry-cookie" });
        return;
      }

      if (isInside(TRIAL_BUTTONS.attune, x, y)) {
        dispatch({ type: "attune" });
      }
    }
  };

  k.onLoadError((name, failedAsset) => {
    const error = new Error(
      `Failed to load Wonder Academy asset ${name}: ${failedAsset.error}`,
    );
    onError?.(error);
    throw error;
  });

  k.scene("wonder-academy", () => {
    sceneReady = true;
    onReady?.();

    k.onKeyPress(["p", "escape"], () => {
      if (renderState.progress) dispatch({ type: "togglePause" });
    });
    k.onKeyPress("m", () => {
      if (renderState.progress && !isPaused(renderState)) dispatch({ type: "openRegionMap" });
    });
    k.onKeyPress("h", () => {
      if (renderState.progress && !isPaused(renderState)) dispatch({ type: "returnHub" });
    });
    k.onKeyPress("t", () => {
      if (renderState.mode === "regionMap" && canStartMoodTrial(renderState)) {
        dispatch({ type: "startMoodTrial", nodeId: renderState.currentNodeId });
      }
    });
    k.onKeyPress("1", () => {
      if (renderState.mode === "moodTrial" && !isPaused(renderState)) dispatch({ type: "comfort" });
    });
    k.onKeyPress("2", () => {
      if (renderState.mode === "moodTrial" && !isPaused(renderState)) {
        dispatch({ type: "skill", skillId: "tiny-flash" });
      }
    });
    k.onKeyPress("3", () => {
      if (renderState.mode === "moodTrial" && !isPaused(renderState)) {
        dispatch({ type: "snack", snackId: "starberry-cookie" });
      }
    });
    k.onKeyPress("4", () => {
      if (renderState.mode === "moodTrial" && !isPaused(renderState)) dispatch({ type: "attune" });
    });

    const clientToGamePos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * WONDER_ACADEMY_WIDTH,
        y: ((clientY - rect.top) / rect.height) * WONDER_ACADEMY_HEIGHT,
      };
    };

    let lastCanvasPressAt = 0;
    const handleCanvasPress = (
      event: MouseEvent | PointerEvent | TouchEvent,
      clientX: number,
      clientY: number,
    ) => {
      if (event.target !== canvas) return;

      event.preventDefault();

      const now = window.performance.now();
      if (now - lastCanvasPressAt < 180) return;

      lastCanvasPressAt = now;
      const pos = clientToGamePos(clientX, clientY);
      handleGamePress(pos.x, pos.y);
    };

    const handlePointerDown = (event: PointerEvent) => {
      handleCanvasPress(event, event.clientX, event.clientY);
    };
    const handleMouseDown = (event: MouseEvent) => {
      handleCanvasPress(event, event.clientX, event.clientY);
    };
    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      handleCanvasPress(event, touch.clientX, touch.clientY);
    };
    const cleanupNativeInput = () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("touchstart", handleTouchStart);
      sceneCleanups.delete(cleanupNativeInput);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    sceneCleanups.add(cleanupNativeInput);
    k.onSceneLeave(cleanupNativeInput);

    k.onUpdate(() => {
      floaters.forEach(({ obj, baseY, speed, amplitude }) => {
        if (!obj.exists()) return;
        obj.pos.y = baseY + Math.sin(k.time() * speed) * amplitude;
      });
    });

    render();
  });

  startKaplaySceneWhenReady(k, "wonder-academy");

  return {
    dispatch,
    updateState: (nextState) => {
      renderState = nextState;
      feedbackMessage = null;
      render();
    },
    quit: () => {
      sceneCleanups.forEach((cleanup) => cleanup());
      sceneCleanups.clear();
      k.debug.timeScale = 1;
      k.quit();
    },
  };
}
