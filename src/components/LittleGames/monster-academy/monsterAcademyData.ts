export const MONSTER_ACADEMY_SAVE_KEY = "ollie-monster-academy-save";
export const MONSTER_ACADEMY_BEST_KEY = "ollie-monster-academy-best";

export type MonsterAcademyEnemy = {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  element: "spark" | "riddle" | "echo" | "star";
};

export type MonsterAcademyBattle = {
  id: string;
  kind: "normal" | "boss";
  enemyId: string;
  enemy: MonsterAcademyEnemy;
  objective: string;
  rewardStars: number;
};

export type MonsterAcademyChapter = {
  id: string;
  title: string;
  battles: MonsterAcademyBattle[];
};

export type MonsterAcademyAction = "attack" | "magic" | "item" | "run";

export type MonsterAcademyBattleStatus =
  | "active"
  | "won"
  | "lost"
  | "fled";

export type MonsterAcademyBattleEvent =
  | "attack"
  | "magic"
  | "item"
  | "run"
  | "enemy-hit"
  | "ollie-assist"
  | "victory"
  | "defeat";

export type MonsterAcademyBattleState = {
  battleId: string;
  enemy: MonsterAcademyEnemy;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  combo: number;
  items: number;
  turn: number;
  status: MonsterAcademyBattleStatus;
  lastEvent: MonsterAcademyBattleEvent;
};

export type MonsterAcademySave = {
  chapterId: string;
  battleIndex: number;
  stars: number;
  unlockedAt: string;
};

const MONSTER_ACADEMY_ENEMIES: MonsterAcademyEnemy[] = [
  {
    id: "glimmer-puff",
    name: "Glimmer Puff",
    maxHp: 3,
    attack: 1,
    element: "spark",
  },
  {
    id: "riddle-moth",
    name: "Riddle Moth",
    maxHp: 3,
    attack: 1,
    element: "riddle",
  },
  {
    id: "echo-drake",
    name: "Echo Drake",
    maxHp: 4,
    attack: 1,
    element: "echo",
  },
  {
    id: "muddlefox",
    name: "Muddlefox",
    maxHp: 7,
    attack: 1,
    element: "star",
  },
];

function getEnemy(enemyId: string): MonsterAcademyEnemy {
  const enemy = MONSTER_ACADEMY_ENEMIES.find((item) => item.id === enemyId);

  if (!enemy) {
    throw new Error(`Unknown Monster Academy enemy: ${enemyId}`);
  }

  return enemy;
}

export function buildMonsterAcademyChapter(): MonsterAcademyChapter {
  return {
    id: "crystal-bell-trial",
    title: "Crystal Bell Trial",
    battles: [
      {
        id: "courtyard-spark",
        kind: "normal",
        enemyId: "glimmer-puff",
        enemy: getEnemy("glimmer-puff"),
        objective: "Wake the courtyard crystal",
        rewardStars: 1,
      },
      {
        id: "library-riddle",
        kind: "normal",
        enemyId: "riddle-moth",
        enemy: getEnemy("riddle-moth"),
        objective: "Open the library tower",
        rewardStars: 2,
      },
      {
        id: "garden-echo",
        kind: "normal",
        enemyId: "echo-drake",
        enemy: getEnemy("echo-drake"),
        objective: "Charge the garden portal",
        rewardStars: 2,
      },
      {
        id: "arena-muddlefox",
        kind: "boss",
        enemyId: "muddlefox",
        enemy: getEnemy("muddlefox"),
        objective: "Repair the Crystal Bell",
        rewardStars: 4,
      },
    ],
  };
}

export function createInitialBattleState(
  battle: MonsterAcademyBattle,
): MonsterAcademyBattleState {
  return {
    battleId: battle.id,
    enemy: battle.enemy,
    playerHp: 5,
    playerMaxHp: 5,
    enemyHp: battle.enemy.maxHp,
    combo: 0,
    items: 2,
    turn: 1,
    status: "active",
    lastEvent: "attack",
  };
}

function applyEnemyCounter(
  state: MonsterAcademyBattleState,
): MonsterAcademyBattleState {
  if (state.enemyHp <= 0) {
    return {
      ...state,
      enemyHp: 0,
      status: "won",
      lastEvent: "victory",
    };
  }

  const nextPlayerHp = Math.max(0, state.playerHp - state.enemy.attack);

  if (nextPlayerHp <= 0) {
    return {
      ...state,
      playerHp: 0,
      status: "lost",
      lastEvent: "defeat",
    };
  }

  return {
    ...state,
    playerHp: nextPlayerHp,
    turn: state.turn + 1,
  };
}

export function applyBattleAction(
  state: MonsterAcademyBattleState,
  action: MonsterAcademyAction,
): MonsterAcademyBattleState {
  if (state.status !== "active") return state;

  if (action === "run") {
    return {
      ...state,
      status: "fled",
      lastEvent: "run",
    };
  }

  if (action === "item") {
    if (state.items <= 0) {
      return {
        ...state,
        lastEvent: "item",
      };
    }

    return {
      ...state,
      playerHp: Math.min(state.playerMaxHp, state.playerHp + 1),
      items: Math.max(0, state.items - 1),
      turn: state.turn + 1,
      lastEvent: "item",
    };
  }

  const damage = action === "magic" ? 2 : 1;
  const nextCombo = state.combo + 1;
  const assistDamage = nextCombo >= 3 ? 1 : 0;
  const enemyHp = Math.max(0, state.enemyHp - damage - assistDamage);
  const attacked: MonsterAcademyBattleState = {
    ...state,
    enemyHp,
    combo: nextCombo >= 3 ? 0 : nextCombo,
    lastEvent: assistDamage > 0 ? "ollie-assist" : action,
  };

  if (enemyHp <= 0) {
    return {
      ...attacked,
      status: "won",
      lastEvent: "victory",
    };
  }

  return applyEnemyCounter(attacked);
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getMonsterAcademySave(
  storage = getStorage(),
): MonsterAcademySave | null {
  if (!storage) return null;

  const stored = storage.getItem(MONSTER_ACADEMY_SAVE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as MonsterAcademySave;

    if (
      typeof parsed.chapterId !== "string" ||
      !Number.isInteger(parsed.battleIndex) ||
      !Number.isInteger(parsed.stars) ||
      typeof parsed.unlockedAt !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function setMonsterAcademySave(
  save: MonsterAcademySave,
  storage = getStorage(),
): MonsterAcademySave | null {
  if (!storage) return null;

  storage.setItem(MONSTER_ACADEMY_SAVE_KEY, JSON.stringify(save));

  return save;
}

export function clearMonsterAcademySave(storage = getStorage()): void {
  storage?.removeItem(MONSTER_ACADEMY_SAVE_KEY);
}

export function getMonsterAcademyBest(storage = getStorage()): number {
  if (!storage) return 0;

  const parsed = Number.parseInt(
    storage.getItem(MONSTER_ACADEMY_BEST_KEY) ?? "",
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function setMonsterAcademyBest(
  stars: number,
  storage = getStorage(),
): number {
  if (!storage) return 0;

  const best = Math.max(getMonsterAcademyBest(storage), Math.max(0, stars));
  storage.setItem(MONSTER_ACADEMY_BEST_KEY, String(best));

  return best;
}
