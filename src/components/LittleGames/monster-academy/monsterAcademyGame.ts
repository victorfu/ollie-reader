import kaplay, { type GameObj, type KAPLAYCtx, type TextComp } from "kaplay";
import { playSound } from "../../../services/gameService";
import {
  applyBattleAction,
  buildMonsterAcademyChapter,
  clearMonsterAcademySave,
  createInitialBattleState,
  getMonsterAcademyBest,
  getMonsterAcademySave,
  setMonsterAcademyBest,
  setMonsterAcademySave,
  type MonsterAcademyAction,
  type MonsterAcademyBattle,
  type MonsterAcademyBattleState,
} from "./monsterAcademyData";
import { startKaplaySceneWhenReady } from "./kaplayLifecycle";

export const MONSTER_ACADEMY_WIDTH = 1280;
export const MONSTER_ACADEMY_HEIGHT = 800;

export type MonsterAcademyAssets = {
  academyCourtyard: string;
  battleArena: string;
  hero: string;
  ollie: string;
  glimmerPuff: string;
  riddleMoth: string;
  echoDrake: string;
  muddlefox: string;
};

export type MonsterAcademyMode = "map" | "battle" | "complete";

export type MonsterAcademySnapshot = {
  mode: MonsterAcademyMode;
  battleIndex: number;
  totalBattles: number;
  stars: number;
  bestStars: number;
  playerHp: number;
  playerMaxHp: number;
  enemyName: string | null;
  enemyHp: number;
  enemyMaxHp: number;
  selectedAction: MonsterAcademyAction;
  paused: boolean;
  message: string;
};

export type MonsterAcademyCallbacks = {
  onReady?: () => void;
  onSnapshot?: (snapshot: MonsterAcademySnapshot) => void;
  onError?: (error: Error) => void;
};

export type MonsterAcademyGameOptions = {
  canvas: HTMLCanvasElement;
  assets: MonsterAcademyAssets;
  callbacks?: MonsterAcademyCallbacks;
};

export type MonsterAcademyGameController = {
  quit: () => void;
  useAction: (action: MonsterAcademyAction) => void;
  advance: () => void;
  togglePause: () => void;
  restartChapter: () => void;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FloatingObject = {
  obj: GameObj;
  baseY: number;
  speed: number;
  amplitude: number;
};

const BACKGROUND_WIDTH = MONSTER_ACADEMY_WIDTH;
const BACKGROUND_HEIGHT = MONSTER_ACADEMY_HEIGHT;
const DYNAMIC_TAG = "monster-academy-dynamic";
const BUTTON_Y = 642;
const ACTION_BUTTONS: Record<
  MonsterAcademyAction,
  Rect & { label: string; hint: string }
> = {
  attack: {
    x: 94,
    y: BUTTON_Y,
    width: 236,
    height: 88,
    label: "Attack",
    hint: "steady hit",
  },
  magic: {
    x: 374,
    y: BUTTON_Y,
    width: 236,
    height: 88,
    label: "Magic",
    hint: "strong spell",
  },
  item: {
    x: 654,
    y: BUTTON_Y,
    width: 236,
    height: 88,
    label: "Cookie",
    hint: "heal 1 HP",
  },
  run: {
    x: 934,
    y: BUTTON_Y,
    width: 236,
    height: 88,
    label: "Retreat",
    hint: "back to map",
  },
};
const MAP_START_BUTTON: Rect = { x: 464, y: 714, width: 352, height: 38 };
const RESULT_BUTTON: Rect = { x: 462, y: 640, width: 356, height: 86 };
const PAUSE_BUTTON: Rect = { x: 1040, y: 34, width: 178, height: 72 };
const NODE_RECTS: Rect[] = [
  { x: 424, y: 520, width: 90, height: 90 },
  { x: 588, y: 430, width: 90, height: 90 },
  { x: 762, y: 520, width: 90, height: 90 },
  { x: 950, y: 404, width: 104, height: 104 },
];
const ENEMY_SPRITES: Record<string, keyof MonsterAcademyAssets> = {
  "glimmer-puff": "glimmerPuff",
  "riddle-moth": "riddleMoth",
  "echo-drake": "echoDrake",
  muddlefox: "muddlefox",
};
const ENEMY_SCALES: Record<string, number> = {
  "glimmer-puff": 0.3,
  "riddle-moth": 0.29,
  "echo-drake": 0.3,
  muddlefox: 0.36,
};

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

function playEffect(effect: Parameters<typeof playSound>[0]): void {
  playSound(effect);
}

function addBackdrop(k: KAPLAYCtx, sprite: string): void {
  k.add([
    k.sprite(sprite),
    k.pos(0, 0),
    k.scale(
      MONSTER_ACADEMY_WIDTH / BACKGROUND_WIDTH,
      MONSTER_ACADEMY_HEIGHT / BACKGROUND_HEIGHT,
    ),
    k.z(0),
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
    z?: number;
  } = {},
): void {
  k.add([
    k.rect(rect.width, rect.height, { radius: 22 }),
    k.pos(rect.x, rect.y),
    k.color(options.color ?? "#f8fbff"),
    k.opacity(options.opacity ?? 0.82),
    k.outline(2, k.rgb(options.outline ?? "#ffffff"), 0.6),
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
    }),
    k.pos(x, y),
    k.color(options.color ?? "#172033"),
    k.z(options.z ?? 60),
    DYNAMIC_TAG,
  ]);
}

function addCenteredText(
  k: KAPLAYCtx,
  value: string,
  rect: Rect,
  options: {
    size?: number;
    color?: string;
    yOffset?: number;
    z?: number;
  } = {},
): void {
  addText(k, value, rect.x, rect.y + rect.height / 2 - 14 + (options.yOffset ?? 0), {
    align: "center",
    color: options.color,
    size: options.size,
    width: rect.width,
    z: options.z,
  });
}

function addHpBar(
  k: KAPLAYCtx,
  x: number,
  y: number,
  width: number,
  current: number,
  max: number,
  color: string,
): void {
  const ratio = max > 0 ? clamp(current / max, 0, 1) : 0;

  k.add([
    k.rect(width, 18, { radius: 9 }),
    k.pos(x, y),
    k.color("#172033"),
    k.opacity(0.22),
    k.z(66),
    DYNAMIC_TAG,
  ]);
  k.add([
    k.rect(Math.max(10, width * ratio), 18, { radius: 9 }),
    k.pos(x, y),
    k.color(color),
    k.opacity(0.92),
    k.z(67),
    DYNAMIC_TAG,
  ]);
}

function getEnemySpriteName(enemyId: string): keyof MonsterAcademyAssets {
  return ENEMY_SPRITES[enemyId] ?? "glimmerPuff";
}

function createBattleMessage(
  previous: MonsterAcademyBattleState,
  next: MonsterAcademyBattleState,
  action: MonsterAcademyAction,
): string {
  if (next.status === "won") {
    return `${next.enemy.name} became friendly. The crystal shines!`;
  }

  if (next.status === "lost") {
    return "The academy bell faded. Try the battle again.";
  }

  if (next.status === "fled") {
    return "You stepped back to the academy map.";
  }

  if (action === "item" && previous.items <= 0) {
    return "No moon cookies left. Choose another move.";
  }

  if (action === "item") {
    return "A moon cookie restored 1 HP.";
  }

  if (next.lastEvent === "ollie-assist") {
    return "Ollie swooped in with a bright star assist!";
  }

  return `${next.enemy.name} took the hit and bounced back.`;
}

export function createMonsterAcademyGame({
  canvas,
  assets,
  callbacks,
}: MonsterAcademyGameOptions): MonsterAcademyGameController {
  const k = kaplay({
    canvas,
    width: MONSTER_ACADEMY_WIDTH,
    height: MONSTER_ACADEMY_HEIGHT,
    stretch: true,
    letterbox: true,
    global: false,
    debug: false,
    focus: true,
    touchToMouse: false,
    loadingScreen: false,
    background: [21, 18, 44],
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
  });

  k.loadSprite("academyCourtyard", assets.academyCourtyard);
  k.loadSprite("battleArena", assets.battleArena);
  k.loadSprite("hero", assets.hero);
  k.loadSprite("ollie", assets.ollie);
  k.loadSprite("glimmerPuff", assets.glimmerPuff);
  k.loadSprite("riddleMoth", assets.riddleMoth);
  k.loadSprite("echoDrake", assets.echoDrake);
  k.loadSprite("muddlefox", assets.muddlefox);

  const chapter = buildMonsterAcademyChapter();
  const saved = getMonsterAcademySave();
  const savedIndex =
    saved?.chapterId === chapter.id
      ? clamp(saved.battleIndex, 0, chapter.battles.length)
      : 0;
  const savedStars = saved?.chapterId === chapter.id ? Math.max(0, saved.stars) : 0;
  const sceneCleanups = new Set<() => void>();
  const floaters: FloatingObject[] = [];
  const controls: Omit<MonsterAcademyGameController, "quit"> = {
    useAction: () => {},
    advance: () => {},
    togglePause: () => {},
    restartChapter: () => {},
  };

  let mode: MonsterAcademyMode =
    savedIndex >= chapter.battles.length ? "complete" : "map";
  let battleIndex = savedIndex;
  let selectedBattleIndex = clamp(
    savedIndex,
    0,
    Math.max(0, chapter.battles.length - 1),
  );
  let activeBattleIndex = selectedBattleIndex;
  let stars = savedStars;
  let bestStars = getMonsterAcademyBest();
  let selectedAction: MonsterAcademyAction = "attack";
  let battleState: MonsterAcademyBattleState | null = null;
  let message =
    mode === "complete"
      ? "The Crystal Bell is repaired. Start a fresh chapter any time."
      : "Choose a crystal trial and begin the academy adventure.";
  let paused = false;
  let awardedBattleId: string | null = null;

  const clearDynamicObjects = () => {
    k.query({ include: DYNAMIC_TAG }).forEach((obj) => {
      if (obj.exists()) {
        k.destroy(obj);
      }
    });
    floaters.length = 0;
  };

  const emitSnapshot = () => {
    callbacks?.onSnapshot?.({
      mode,
      battleIndex,
      totalBattles: chapter.battles.length,
      stars,
      bestStars,
      playerHp: battleState?.playerHp ?? 5,
      playerMaxHp: battleState?.playerMaxHp ?? 5,
      enemyName: battleState?.enemy.name ?? null,
      enemyHp: battleState?.enemyHp ?? 0,
      enemyMaxHp: battleState?.enemy.maxHp ?? 0,
      selectedAction,
      paused,
      message,
    });
  };

  const saveProgress = () => {
    setMonsterAcademySave({
      chapterId: chapter.id,
      battleIndex,
      stars,
      unlockedAt: new Date().toISOString(),
    });
    bestStars = setMonsterAcademyBest(stars);
  };

  const addFloatingSprite = (
    sprite: string,
    x: number,
    y: number,
    scale: number,
    options: { z?: number; speed?: number; amplitude?: number } = {},
  ) => {
    const obj = k.add([
      k.sprite(sprite),
      k.pos(x, y),
      k.anchor("center"),
      k.scale(scale),
      k.z(options.z ?? 24),
      DYNAMIC_TAG,
    ]);
    floaters.push({
      obj,
      baseY: y,
      speed: options.speed ?? 1.4,
      amplitude: options.amplitude ?? 5,
    });
  };

  const renderBattleHud = (battle: MonsterAcademyBattle) => {
    if (!battleState) return;

    addPanel(k, { x: 28, y: 24, width: 310, height: 104 });
    addText(k, "Ollie Academy", 54, 46, { size: 24, width: 260 });
    addText(
      k,
      `HP ${battleState.playerHp}/${battleState.playerMaxHp}  Stars ${stars}`,
      54,
      86,
      { color: "#344054", size: 19, width: 260 },
    );
    addHpBar(k, 54, 112, 246, battleState.playerHp, battleState.playerMaxHp, "#32d583");

    addPanel(k, { x: 360, y: 24, width: 560, height: 104 });
    addText(k, `Trial ${activeBattleIndex + 1}: ${battle.objective}`, 386, 46, {
      size: 21,
      width: 508,
    });
    addText(k, message, 386, 82, {
      color: "#344054",
      size: 18,
      width: 508,
    });

    addPanel(k, PAUSE_BUTTON, {
      color: paused ? "#fff7ed" : "#eff8ff",
    });
    addCenteredText(k, paused ? "Resume" : "Pause", PAUSE_BUTTON, {
      color: "#172033",
      size: 24,
    });

    addPanel(k, { x: 826, y: 116, width: 330, height: 72 }, { opacity: 0.78 });
    addText(k, battle.enemy.name, 852, 132, { size: 22, width: 190 });
    addText(k, `HP ${battleState.enemyHp}/${battle.enemy.maxHp}`, 1042, 132, {
      align: "right",
      color: "#344054",
      size: 18,
      width: 82,
    });
    addHpBar(k, 852, 168, 272, battleState.enemyHp, battle.enemy.maxHp, "#f97066");
  };

  const renderBattleActions = () => {
    if (!battleState) return;

    if (battleState.status !== "active") {
      addPanel(k, RESULT_BUTTON, {
        color: battleState.status === "won" ? "#ecfdf3" : "#fff7ed",
        opacity: 0.9,
      });
      addCenteredText(
        k,
        battleState.status === "won"
          ? battleIndex >= chapter.battles.length
            ? "See Finale"
            : "Return to Map"
          : battleState.status === "lost"
            ? "Try Again"
            : "Return to Map",
        RESULT_BUTTON,
        { size: 26 },
      );
      return;
    }

    (Object.keys(ACTION_BUTTONS) as MonsterAcademyAction[]).forEach((action) => {
      const button = ACTION_BUTTONS[action];
      const selected = selectedAction === action;
      addPanel(k, button, {
        color: selected ? "#fff7ed" : "#f8fbff",
        opacity: selected ? 0.94 : 0.82,
        outline: selected ? "#fdb022" : "#ffffff",
      });
      addText(k, button.label, button.x, button.y + 18, {
        align: "center",
        color: selected ? "#7a2e0e" : "#172033",
        size: 24,
        width: button.width,
      });
      addText(k, button.hint, button.x, button.y + 52, {
        align: "center",
        color: "#667085",
        size: 16,
        width: button.width,
      });
    });
  };

  const renderBattle = () => {
    const battle = chapter.battles[activeBattleIndex];
    if (!battle || !battleState) return;

    addBackdrop(k, "battleArena");
    k.add([
      k.rect(MONSTER_ACADEMY_WIDTH, MONSTER_ACADEMY_HEIGHT),
      k.pos(0, 0),
      k.color("#102033"),
      k.opacity(0.1),
      k.z(4),
      DYNAMIC_TAG,
    ]);
    addFloatingSprite("hero", 234, 524, 0.27, {
      z: 22,
      speed: 1.1,
      amplitude: 4,
    });
    addFloatingSprite("ollie", 380, 390, 0.16, {
      z: 26,
      speed: 1.8,
      amplitude: 7,
    });
    addFloatingSprite(
      getEnemySpriteName(battle.enemy.id),
      battle.kind === "boss" ? 930 : 914,
      battle.kind === "boss" ? 460 : 472,
      ENEMY_SCALES[battle.enemy.id] ?? 0.3,
      { z: 24, speed: 1.25, amplitude: 6 },
    );
    renderBattleHud(battle);
    renderBattleActions();
  };

  const renderMap = () => {
    addBackdrop(k, "academyCourtyard");
    k.add([
      k.rect(MONSTER_ACADEMY_WIDTH, MONSTER_ACADEMY_HEIGHT),
      k.pos(0, 0),
      k.color("#101828"),
      k.opacity(0.08),
      k.z(4),
      DYNAMIC_TAG,
    ]);

    addPanel(k, { x: 40, y: 36, width: 482, height: 124 });
    addText(k, "Ollie Monster Academy", 70, 58, {
      color: "#172033",
      size: 30,
      width: 420,
    });
    addText(k, chapter.title, 72, 104, {
      color: "#475467",
      size: 20,
      width: 400,
    });

    addPanel(k, { x: 930, y: 36, width: 300, height: 124 });
    addText(k, `${stars} ★`, 958, 58, { size: 30, width: 110 });
    addText(k, `Best ${bestStars} ★`, 1080, 66, {
      align: "right",
      color: "#344054",
      size: 20,
      width: 120,
    });
    addText(k, `${Math.min(battleIndex, chapter.battles.length)}/${chapter.battles.length} trials`, 958, 108, {
      color: "#475467",
      size: 18,
      width: 220,
    });

    addFloatingSprite("hero", 214, 592, 0.22, {
      z: 20,
      speed: 1.1,
      amplitude: 4,
    });
    addFloatingSprite("ollie", 346, 520, 0.13, {
      z: 24,
      speed: 1.8,
      amplitude: 8,
    });

    chapter.battles.forEach((_, index) => {
      const rect = NODE_RECTS[index];
      const unlocked = index <= battleIndex;
      const completed = index < battleIndex;
      const selected = index === selectedBattleIndex;

      addPanel(k, rect, {
        color: completed ? "#ecfdf3" : unlocked ? "#eff8ff" : "#f2f4f7",
        opacity: unlocked ? 0.9 : 0.68,
        outline: selected ? "#fdb022" : "#ffffff",
        z: selected ? 52 : 42,
      });
      addCenteredText(k, completed ? "★" : unlocked ? `${index + 1}` : "LOCK", rect, {
        color: completed ? "#027a48" : unlocked ? "#175cd3" : "#667085",
        size: completed ? 32 : unlocked ? 28 : 16,
        z: selected ? 70 : 62,
      });
    });

    const selectedBattle = chapter.battles[selectedBattleIndex];
    addPanel(k, { x: 354, y: 604, width: 574, height: 160 }, { opacity: 0.9 });
    addText(k, selectedBattle?.enemy.name ?? "Crystal Bell repaired", 384, 622, {
      align: "center",
      size: 22,
      width: 514,
    });
    addText(k, selectedBattle?.objective ?? "Start a fresh chapter any time.", 392, 650, {
      align: "center",
      color: "#344054",
      size: 16,
      width: 496,
    });
    addText(k, message, 392, 674, {
      align: "center",
      color: "#475467",
      size: 15,
      width: 496,
    });
    addPanel(k, MAP_START_BUTTON, {
      color: selectedBattleIndex <= battleIndex ? "#fff7ed" : "#f2f4f7",
      opacity: 0.94,
      outline: "#fdb022",
      z: 58,
    });
    addCenteredText(
      k,
      selectedBattleIndex <= battleIndex ? "Start Trial" : "Locked",
      MAP_START_BUTTON,
      { color: "#7a2e0e", size: 25, z: 74 },
    );
  };

  const renderComplete = () => {
    addBackdrop(k, "academyCourtyard");
    k.add([
      k.rect(MONSTER_ACADEMY_WIDTH, MONSTER_ACADEMY_HEIGHT),
      k.pos(0, 0),
      k.color("#101828"),
      k.opacity(0.12),
      k.z(4),
      DYNAMIC_TAG,
    ]);
    addFloatingSprite("hero", 302, 542, 0.25, {
      z: 20,
      speed: 1.1,
      amplitude: 4,
    });
    addFloatingSprite("ollie", 460, 430, 0.16, {
      z: 24,
      speed: 1.8,
      amplitude: 8,
    });
    addPanel(k, { x: 362, y: 178, width: 560, height: 318 }, { opacity: 0.92 });
    addText(k, "Crystal Bell Restored", 402, 218, {
      align: "center",
      size: 34,
      width: 480,
    });
    addText(k, `${stars} ★ collected`, 402, 284, {
      align: "center",
      color: "#7a2e0e",
      size: 28,
      width: 480,
    });
    addText(k, "The academy monsters are now your friends.", 430, 346, {
      align: "center",
      color: "#475467",
      size: 20,
      width: 420,
    });
    addPanel(k, RESULT_BUTTON, {
      color: "#fff7ed",
      opacity: 0.95,
      outline: "#fdb022",
    });
    addCenteredText(k, "Restart Chapter", RESULT_BUTTON, {
      color: "#7a2e0e",
      size: 26,
    });
  };

  const render = () => {
    clearDynamicObjects();

    if (mode === "battle") {
      renderBattle();
    } else if (mode === "complete") {
      renderComplete();
    } else {
      renderMap();
    }

    emitSnapshot();
  };

  const startBattle = (index: number) => {
    const battle = chapter.battles[index];
    if (!battle || index > battleIndex) return;

    activeBattleIndex = index;
    selectedBattleIndex = index;
    battleState = createInitialBattleState(battle);
    selectedAction = "attack";
    mode = "battle";
    paused = false;
    awardedBattleId = null;
    message = `${battle.enemy.name} appeared. Choose a move.`;
    playEffect("click");
    render();
  };

  const returnToMap = () => {
    battleState = null;
    selectedBattleIndex = clamp(
      battleIndex,
      0,
      Math.max(0, chapter.battles.length - 1),
    );
    mode = battleIndex >= chapter.battles.length ? "complete" : "map";
    paused = false;
    message =
      mode === "complete"
        ? "The Crystal Bell is repaired. Start a fresh chapter any time."
        : "Choose the next crystal trial.";
    render();
  };

  const awardBattleIfNeeded = (battle: MonsterAcademyBattle) => {
    if (awardedBattleId === battle.id || activeBattleIndex < battleIndex) {
      return;
    }

    awardedBattleId = battle.id;
    stars += battle.rewardStars;
    battleIndex = Math.max(battleIndex, activeBattleIndex + 1);
    saveProgress();
  };

  const performAction = (action: MonsterAcademyAction) => {
    if (paused) return;

    if (mode !== "battle" || !battleState) {
      return;
    }

    if (battleState.status !== "active") {
      controls.advance();
      return;
    }

    const previous = battleState;
    selectedAction = action;
    battleState = applyBattleAction(battleState, action);
    message = createBattleMessage(previous, battleState, action);

    if (battleState.status === "won") {
      const battle = chapter.battles[activeBattleIndex];
      if (battle) awardBattleIfNeeded(battle);
      playEffect("levelup");
    } else if (battleState.status === "lost" || battleState.status === "fled") {
      playEffect("wrong");
    } else if (action === "item" && previous.items <= 0) {
      playEffect("wrong");
    } else {
      playEffect(action === "magic" ? "correct" : "click");
    }

    render();
  };

  const selectBattleOffset = (offset: number) => {
    if (mode !== "map") return;

    selectedBattleIndex = clamp(
      selectedBattleIndex + offset,
      0,
      Math.min(battleIndex, chapter.battles.length - 1),
    );
    const selectedBattle = chapter.battles[selectedBattleIndex];
    message = selectedBattle
      ? `${selectedBattle.enemy.name}: ${selectedBattle.objective}`
      : "Choose a crystal trial.";
    playEffect("click");
    render();
  };

  const selectActionOffset = (offset: number) => {
    if (mode !== "battle" || !battleState || battleState.status !== "active") {
      return;
    }

    const actions = Object.keys(ACTION_BUTTONS) as MonsterAcademyAction[];
    const current = actions.indexOf(selectedAction);
    selectedAction = actions[clamp(current + offset, 0, actions.length - 1)];
    playEffect("click");
    render();
  };

  controls.advance = () => {
    if (paused) return;

    if (mode === "map") {
      startBattle(selectedBattleIndex);
      return;
    }

    if (mode === "complete") {
      controls.restartChapter();
      return;
    }

    if (!battleState) return;

    if (battleState.status === "active") {
      performAction(selectedAction);
      return;
    }

    if (battleState.status === "lost") {
      startBattle(activeBattleIndex);
      return;
    }

    returnToMap();
  };

  controls.useAction = (action: MonsterAcademyAction) => {
    if (mode === "battle") {
      performAction(action);
      return;
    }

    controls.advance();
  };

  controls.togglePause = () => {
    if (mode !== "battle" || !battleState || battleState.status !== "active") {
      return;
    }

    paused = !paused;
    message = paused ? "Paused. Press P to resume." : "Choose a move.";
    playEffect("click");
    render();
  };

  controls.restartChapter = () => {
    clearMonsterAcademySave();
    battleIndex = 0;
    selectedBattleIndex = 0;
    activeBattleIndex = 0;
    stars = 0;
    bestStars = getMonsterAcademyBest();
    selectedAction = "attack";
    battleState = null;
    mode = "map";
    paused = false;
    awardedBattleId = null;
    message = "A new academy chapter begins.";
    playEffect("click");
    render();
  };

  k.onLoadError((name, failedAsset) => {
    const error = new Error(
      `Failed to load Monster Academy asset ${name}: ${failedAsset.error}`,
    );
    callbacks?.onError?.(error);
    throw error;
  });

  k.scene("academy", () => {
    callbacks?.onReady?.();

    k.onKeyPress(["right", "d"], () => {
      if (mode === "map") {
        selectBattleOffset(1);
      } else {
        selectActionOffset(1);
      }
    });
    k.onKeyPress(["left", "a"], () => {
      if (mode === "map") {
        selectBattleOffset(-1);
      } else {
        selectActionOffset(-1);
      }
    });
    k.onKeyPress(["enter", "space"], () => controls.advance());
    k.onKeyPress("p", () => controls.togglePause());
    k.onKeyPress("r", () => controls.restartChapter());
    k.onKeyPress("1", () => performAction("attack"));
    k.onKeyPress("2", () => performAction("magic"));
    k.onKeyPress("3", () => performAction("item"));
    k.onKeyPress("4", () => performAction("run"));

    const clientToGamePos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * MONSTER_ACADEMY_WIDTH,
        y: ((clientY - rect.top) / rect.height) * MONSTER_ACADEMY_HEIGHT,
      };
    };

    const handleGamePress = (x: number, y: number) => {
      if (mode === "map") {
        const nodeIndex = NODE_RECTS.findIndex((rect) => isInside(rect, x, y));
        if (nodeIndex >= 0 && nodeIndex <= battleIndex) {
          selectedBattleIndex = nodeIndex;
          message = `${chapter.battles[nodeIndex].enemy.name}: ${chapter.battles[nodeIndex].objective}`;
          render();
          return;
        }

        if (isInside(MAP_START_BUTTON, x, y)) {
          controls.advance();
        }
        return;
      }

      if (mode === "complete") {
        if (isInside(RESULT_BUTTON, x, y)) {
          controls.restartChapter();
        }
        return;
      }

      if (isInside(PAUSE_BUTTON, x, y)) {
        controls.togglePause();
        return;
      }

      if (!battleState) return;

      if (battleState.status !== "active") {
        if (isInside(RESULT_BUTTON, x, y)) {
          controls.advance();
        }
        return;
      }

      const action = (Object.keys(ACTION_BUTTONS) as MonsterAcademyAction[]).find(
        (item) => isInside(ACTION_BUTTONS[item], x, y),
      );
      if (action) {
        performAction(action);
      }
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

  startKaplaySceneWhenReady(k, "academy");

  return {
    quit: () => {
      sceneCleanups.forEach((cleanup) => cleanup());
      sceneCleanups.clear();
      k.debug.timeScale = 1;
      k.quit();
    },
    useAction: (action) => controls.useAction(action),
    advance: () => controls.advance(),
    togglePause: () => controls.togglePause(),
    restartChapter: () => controls.restartChapter(),
  };
}
