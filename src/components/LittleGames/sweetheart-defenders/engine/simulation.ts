import { CAKES_BY_DIFFICULTY, FIRST_PREP_MS, PREP_MS } from "../constants";
import {
  ELEMENT_COLOR,
  SLOW_DURATION_MS,
  STUN_DURATION_MS,
} from "../data/elements";
import { getEnemy } from "../data/enemies";
import { getPet } from "../data/pets";
import { DOT_COLOR, TRAIT_BASE } from "../data/traits";
import { computeDamage, getTowerStats } from "./combat";
import {
  getEarlyStartBonus,
  getPlaceCost,
  getSellRefund,
  getUpgradeCost,
} from "./economy";
import {
  compileFlightPath,
  compilePath,
  distanceSquared,
  pointAtDistance,
  type CompiledPath,
} from "./path";
import { nextRandom } from "./rng";
import { findEnemiesInRadius, findTarget } from "./targeting";
import { buildSpawnQueue, getEnemyHp } from "./waves";
import type {
  AttackStyle,
  BattleState,
  Command,
  Difficulty,
  Element,
  EnemyKind,
  LevelSpec,
  LiveEnemy,
  LiveTower,
  Pet,
  TowerStats,
  Vec2,
} from "../types";

const PROJECTILE_SPEED: Record<AttackStyle, number> = {
  bolt: 900,
  syrupBlob: 480,
  groundPulse: 0,
  beam: 0,
  note: 380,
  mortar: 420,
  shard: 620,
  aura: 0,
};

const EFFECT_LIFE_MS = { splash: 300, pop: 350, heal: 400, steal: 600 } as const;
const BEAM_LIFE_MS = 160;
const FLASH_MS = 90;
const RECOIL_MS = 120;
/** 應援塔不攻擊，但每隔一陣子放個光環，讓玩家看得出它在工作。 */
const CHEER_PULSE_MS = 1300;

/**
 * 關卡的執行期形式：路徑先算好累積長度，塔位放進 Map，
 * 這樣模擬每幀就不用重算不變的東西。
 */
export type CompiledLevel = {
  spec: LevelSpec;
  paths: CompiledPath[];
  /** 飛行怪專用：直接從起點飛到終點，不繞彎 */
  flightPaths: CompiledPath[];
  slotById: Map<string, { id: string; x: number; y: number }>;
};

export function compileLevel(spec: LevelSpec): CompiledLevel {
  return {
    spec,
    paths: spec.paths.map(compilePath),
    flightPaths: spec.paths.map(compileFlightPath),
    slotById: new Map(spec.slots.map((slot) => [slot.id, slot])),
  };
}

export function createBattle(
  level: CompiledLevel,
  difficulty: Difficulty,
  seed: number,
): BattleState {
  return {
    levelId: level.spec.id,
    difficulty,
    timeMs: 0,
    phase: "prep",
    waveIndex: 0,
    prepMs: FIRST_PREP_MS,
    frosting: level.spec.startingFrosting,
    cakes: CAKES_BY_DIFFICULTY[difficulty],
    maxCakes: CAKES_BY_DIFFICULTY[difficulty],
    enemies: [],
    towers: [],
    projectiles: [],
    beams: [],
    effects: [],
    spawnQueue: [],
    kills: 0,
    leaked: 0,
    speed: 1,
    rngState: seed >>> 0,
    nextUid: 1,
  };
}

/**
 * 把模擬往前推 dtMs 毫秒。
 *
 * 就地修改 state 並回傳它——每幀複製整個世界對 60Hz 來說太浪費。重點是這個
 * 函式是**確定性**的：同樣的 (state, commands, dtMs) 一定得到同樣的結果，不碰
 * Math.random、不碰 DOM、不碰時鐘。所以它可以在 vitest 裡跑完整場戰鬥，
 * 之後要做雙人合作時也只要把對方的指令併進 commands 就好。
 */
export function stepSimulation(
  state: BattleState,
  level: CompiledLevel,
  commands: Command[],
  dtMs: number,
): BattleState {
  for (const command of commands) {
    applyCommand(state, level, command);
  }

  if (state.phase === "cleared" || state.phase === "lost") {
    advanceVisuals(state, dtMs);
    state.timeMs += dtMs;
    return state;
  }

  if (state.phase === "prep") {
    state.prepMs -= dtMs;
    if (state.prepMs <= 0) {
      beginWave(state, level, 0);
    }
  }

  if (state.phase === "wave") {
    spawnDueEnemies(state, level);
    updateEnemies(state, level, dtMs);
    updateTowers(state, level, dtMs);
    checkWaveComplete(state, level);
  }

  advanceVisuals(state, dtMs);
  state.timeMs += dtMs;
  return state;
}

// === 指令 ===

function applyCommand(
  state: BattleState,
  level: CompiledLevel,
  command: Command,
): void {
  if (state.phase === "cleared" || state.phase === "lost") return;

  switch (command.kind) {
    case "placeTower": {
      const slot = level.slotById.get(command.slotId);
      const pet = getPet(command.petId);
      if (!slot || !pet) return;
      if (state.towers.some((tower) => tower.slotId === slot.id)) return;

      const cost = getPlaceCost(pet);
      if (state.frosting < cost) return;

      state.frosting -= cost;
      state.towers.push({
        slotId: slot.id,
        petId: pet.id,
        level: 1,
        cooldownMs: 0,
        totalDamage: 0,
        recoilMs: 0,
        comboHits: 0,
        comboTargetUid: 0,
      });
      return;
    }

    case "upgradeTower": {
      const tower = state.towers.find((t) => t.slotId === command.slotId);
      const pet = tower ? getPet(tower.petId) : undefined;
      if (!tower || !pet || tower.level === 3) return;

      const cost = getUpgradeCost(pet, tower.level);
      if (state.frosting < cost) return;

      state.frosting -= cost;
      tower.level = (tower.level + 1) as 1 | 2 | 3;
      return;
    }

    case "sellTower": {
      const index = state.towers.findIndex((t) => t.slotId === command.slotId);
      if (index === -1) return;

      const tower = state.towers[index];
      const pet = getPet(tower.petId);
      if (pet) state.frosting += getSellRefund(pet, tower.level);
      state.towers.splice(index, 1);
      return;
    }

    case "startWave": {
      if (state.phase !== "prep") return;
      beginWave(state, level, getEarlyStartBonus(state.prepMs));
      return;
    }

    case "setSpeed": {
      state.speed = command.multiplier;
      return;
    }
  }
}

function beginWave(
  state: BattleState,
  level: CompiledLevel,
  earlyBonus: number,
): void {
  const wave = level.spec.waves[state.waveIndex];
  if (!wave) return;

  state.frosting += earlyBonus;
  state.prepMs = 0;
  state.phase = "wave";
  state.spawnQueue = buildSpawnQueue(wave, state.timeMs);
}

// === 敵人 ===

function pathFor(level: CompiledLevel, enemy: LiveEnemy): CompiledPath {
  const flying = getEnemy(enemy.kind).flying === true;
  const paths = flying ? level.flightPaths : level.paths;
  return paths[enemy.pathIndex] ?? paths[0];
}

/** 造一隻怪但不放進世界，由呼叫端決定何時加入（避免在迭代中改陣列）。 */
function createEnemy(
  state: BattleState,
  level: CompiledLevel,
  kind: EnemyKind,
  pathIndex: number,
  atDistance: number,
): LiveEnemy {
  const spec = getEnemy(kind);
  const hp = getEnemyHp(kind, state.waveIndex, state.difficulty);
  const enemy: LiveEnemy = {
    uid: state.nextUid++,
    kind,
    hp,
    maxHp: hp,
    shieldHp: 0,
    pathIndex,
    distance: atDistance,
    remaining: 0,
    x: 0,
    y: 0,
    slowMs: 0,
    slowFactor: 0,
    stunMs: 0,
    dotDps: 0,
    dotMs: 0,
    dotColor: DOT_COLOR.toxin,
    armorShred: 0,
    nextSummonMs: spec.summon ? state.timeMs + spec.summon.everyMs : 0,
    nextShieldMs: spec.shield ? state.timeMs + spec.shield.everyMs : 0,
    flashMs: 0,
  };

  syncEnemyPosition(enemy, pathFor(level, enemy));
  return enemy;
}

function syncEnemyPosition(enemy: LiveEnemy, path: CompiledPath): void {
  const point = pointAtDistance(path, enemy.distance);
  enemy.x = point.x;
  enemy.y = point.y;
  enemy.remaining = Math.max(0, path.totalLength - enemy.distance);
}

function spawnDueEnemies(state: BattleState, level: CompiledLevel): void {
  while (state.spawnQueue.length > 0 && state.spawnQueue[0].atMs <= state.timeMs) {
    const entry = state.spawnQueue.shift()!;
    state.enemies.push(createEnemy(state, level, entry.kind, entry.pathIndex, 0));
  }
}

function updateEnemies(
  state: BattleState,
  level: CompiledLevel,
  dtMs: number,
): void {
  const dtSeconds = dtMs / 1000;
  const survivors: LiveEnemy[] = [];
  // Boss 召喚、分裂出來的小兵先擱著，等這一輪走完再加進世界，
  // 免得在迭代 state.enemies 的中途改動它。
  const arrivals: LiveEnemy[] = [];

  for (const enemy of state.enemies) {
    const spec = getEnemy(enemy.kind);

    enemy.slowMs = Math.max(0, enemy.slowMs - dtMs);
    enemy.stunMs = Math.max(0, enemy.stunMs - dtMs);
    if (enemy.slowMs === 0) enemy.slowFactor = 0;

    // 持續傷害無視護甲——毒和火已經在身上了。
    if (enemy.dotMs > 0) {
      enemy.hp -= enemy.dotDps * dtSeconds;
      enemy.dotMs = Math.max(0, enemy.dotMs - dtMs);
      if (enemy.dotMs === 0) enemy.dotDps = 0;

      if (enemy.hp <= 0) {
        defeatEnemy(state, level, enemy, arrivals);
        continue;
      }
    }

    const speedFactor =
      enemy.stunMs > 0 ? 0 : 1 - (enemy.slowMs > 0 ? enemy.slowFactor : 0);
    enemy.distance += spec.speed * speedFactor * dtSeconds;

    const path = pathFor(level, enemy);
    syncEnemyPosition(enemy, path);

    if (enemy.distance >= path.totalLength) {
      stealCakes(state, enemy, spec.cakeSteal);
      continue;
    }

    collectBossSummons(state, level, enemy, arrivals);
    survivors.push(enemy);
  }

  state.enemies = survivors.concat(arrivals);

  if (state.cakes <= 0) {
    state.cakes = 0;
    state.phase = "lost";
  }
}

function stealCakes(state: BattleState, enemy: LiveEnemy, amount: number): void {
  state.cakes -= amount;
  state.leaked += amount;
  addEffect(state, "steal", enemy, 26, "#ff6b8a");
}

function collectBossSummons(
  state: BattleState,
  level: CompiledLevel,
  enemy: LiveEnemy,
  into: LiveEnemy[],
): void {
  const spec = getEnemy(enemy.kind);

  if (spec.summon && state.timeMs >= enemy.nextSummonMs) {
    enemy.nextSummonMs = state.timeMs + spec.summon.everyMs;
    for (let index = 0; index < spec.summon.count; index += 1) {
      // 從 Boss 身後一點點冒出來，才不會整群疊在同一個座標上。
      const behind = Math.max(0, enemy.distance - 18 - index * 14);
      into.push(createEnemy(state, level, spec.summon.kind, enemy.pathIndex, behind));
    }
  }

  if (spec.shield && state.timeMs >= enemy.nextShieldMs) {
    enemy.nextShieldMs = state.timeMs + spec.shield.everyMs;
    enemy.shieldHp = Math.max(enemy.shieldHp, spec.shield.amount);
  }
}

// === 塔 ===

function updateTowers(
  state: BattleState,
  level: CompiledLevel,
  dtMs: number,
): void {
  const cheerBonusBySlot = computeCheerBonuses(state, level);

  for (const tower of state.towers) {
    const pet = getPet(tower.petId);
    const slot = level.slotById.get(tower.slotId);
    if (!pet || !slot) continue;

    const stats = getTowerStats(pet, tower.level);

    if (stats.archetype === "cheer") {
      tower.cooldownMs -= dtMs;
      if (tower.cooldownMs <= 0) {
        tower.cooldownMs = CHEER_PULSE_MS;
        addEffect(state, "heal", slot, stats.range, ELEMENT_COLOR[stats.element]);
      }
      continue;
    }

    const speedMultiplier =
      1 + (cheerBonusBySlot.get(tower.slotId) ?? 0) + encoreBonus(tower, stats);
    tower.cooldownMs -= dtMs * speedMultiplier;
    if (tower.cooldownMs > 0) continue;

    if (fireTower(state, level, tower, pet, stats, slot)) {
      tower.cooldownMs = stats.cooldownMs;
      tower.recoilMs = RECOIL_MS;
    } else {
      // 沒有目標就別讓冷卻一直往負數掉，否則怪一出現會爆發式連射。
      tower.cooldownMs = 0;
      tower.comboHits = 0;
      tower.comboTargetUid = 0;
    }
  }
}

/** 連擊特性：一直打同一隻目標會越打越快。 */
function encoreBonus(tower: LiveTower, stats: TowerStats): number {
  if (stats.trait !== "encore") return 0;
  const ratio = Math.min(
    TRAIT_BASE.encore.max,
    TRAIT_BASE.encore.perHit * tower.comboHits,
  );
  return ratio * stats.traitPower;
}

/** 每座應援塔給射程內的其他塔攻速加成，效果會疊加。 */
function computeCheerBonuses(
  state: BattleState,
  level: CompiledLevel,
): Map<string, number> {
  const bonuses = new Map<string, number>();

  for (const cheerTower of state.towers) {
    const pet = getPet(cheerTower.petId);
    const origin = level.slotById.get(cheerTower.slotId);
    if (!pet || !origin) continue;

    const stats = getTowerStats(pet, cheerTower.level);
    if (stats.archetype !== "cheer") continue;

    const rangeSquared = stats.range * stats.range;
    for (const other of state.towers) {
      if (other.slotId === cheerTower.slotId) continue;
      const target = level.slotById.get(other.slotId);
      if (!target) continue;
      if (distanceSquared(origin, target) > rangeSquared) continue;

      bonuses.set(other.slotId, (bonuses.get(other.slotId) ?? 0) + stats.cheerBonus);
    }
  }

  return bonuses;
}

function fireTower(
  state: BattleState,
  level: CompiledLevel,
  tower: LiveTower,
  pet: Pet,
  stats: TowerStats,
  slot: Vec2,
): boolean {
  const secondaryElements = pet.elements.slice(1);
  const color = ELEMENT_COLOR[stats.element];

  // 藤蔓是「腳邊灑範圍傷害」，射程本身就是攻擊範圍，不用挑單一目標。
  if (stats.archetype === "vine") {
    const inRange = findEnemiesInRadius(slot, stats.range, state.enemies);
    if (inRange.length === 0) return false;

    for (const enemy of inRange) {
      hitEnemy(state, level, tower, enemy, stats, secondaryElements, 1);
    }
    addEffect(state, "splash", slot, stats.range, color);
    return true;
  }

  const target = findTarget(slot, stats.range, state.enemies);
  if (!target) return false;

  // 連擊特性要知道有沒有換目標。
  if (target.uid === tower.comboTargetUid) {
    tower.comboHits += 1;
  } else {
    tower.comboTargetUid = target.uid;
    tower.comboHits = 1;
  }

  if (stats.attackStyle === "beam") {
    addBeam(state, [{ ...slot }, { x: target.x, y: target.y }], color, 3.5);
  } else {
    spawnProjectile(state, slot, target, color, stats.attackStyle);
  }

  hitEnemy(state, level, tower, target, stats, secondaryElements, 1);

  if (stats.splashRadius > 0) {
    for (const enemy of findEnemiesInRadius(target, stats.splashRadius, state.enemies)) {
      if (enemy.uid === target.uid) continue;
      hitEnemy(state, level, tower, enemy, stats, secondaryElements, 1);
    }
    addEffect(state, "splash", target, stats.splashRadius, color);
  }

  if (stats.slowFactor > 0) {
    applySlow(target, stats.slowFactor, SLOW_DURATION_MS);
  }

  if (stats.stunChance > 0 && nextRandom(state) < stats.stunChance) {
    target.stunMs = Math.max(target.stunMs, STUN_DURATION_MS);
  }

  applyTrait(state, level, tower, stats, secondaryElements, target, slot, color);
  return true;
}

/**
 * 副元素帶來的額外效果。主要打法（傷害、濺射、減速、暈眩）在 fireTower 就處理
 * 完了，這裡只加特性那一層。
 */
function applyTrait(
  state: BattleState,
  level: CompiledLevel,
  tower: LiveTower,
  stats: TowerStats,
  secondaryElements: Element[],
  target: LiveEnemy,
  origin: Vec2,
  color: string,
): void {
  switch (stats.trait) {
    case "chain": {
      const jumps = Math.max(1, Math.round(TRAIT_BASE.chain.targets * stats.traitPower));
      const path: Vec2[] = [{ ...origin }, { x: target.x, y: target.y }];
      const hit = new Set<number>([target.uid]);
      let from = target;

      for (let jump = 0; jump < jumps; jump += 1) {
        const next = nearestUnhit(state, from, TRAIT_BASE.chain.range, hit);
        if (!next) break;

        hit.add(next.uid);
        path.push({ x: next.x, y: next.y });
        hitEnemy(
          state,
          level,
          tower,
          next,
          stats,
          secondaryElements,
          TRAIT_BASE.chain.damageRatio,
        );
        from = next;
      }

      if (path.length > 2) addBeam(state, path, color, 2.5);
      return;
    }

    case "chill":
      applySlow(
        target,
        Math.min(0.5, TRAIT_BASE.chill.slowFactor * stats.traitPower),
        TRAIT_BASE.chill.durationMs,
      );
      return;

    case "toxin":
      applyDot(
        target,
        TRAIT_BASE.toxin.dps * stats.traitPower,
        TRAIT_BASE.toxin.durationMs,
        DOT_COLOR.toxin,
      );
      return;

    case "daze":
      if (nextRandom(state) < TRAIT_BASE.daze.chance * stats.traitPower) {
        target.stunMs = Math.max(target.stunMs, TRAIT_BASE.daze.durationMs);
      }
      return;

    case "scorch": {
      const radius = TRAIT_BASE.scorch.radius;
      for (const enemy of findEnemiesInRadius(target, radius, state.enemies)) {
        applyDot(
          enemy,
          TRAIT_BASE.scorch.dps * stats.traitPower,
          TRAIT_BASE.scorch.durationMs,
          DOT_COLOR.scorch,
        );
      }
      addEffect(state, "splash", target, radius, DOT_COLOR.scorch);
      return;
    }

    case "shred":
      target.armorShred = Math.min(
        TRAIT_BASE.shred.max,
        target.armorShred + TRAIT_BASE.shred.perHit * stats.traitPower,
      );
      return;

    // 純粹與專注在 getTowerStats / computeDamage 就算進去了；
    // 連擊靠 tower.comboHits，在 updateTowers 影響攻速。
    case "pure":
    case "focus":
    case "encore":
      return;
  }
}

/**
 * 連鎖跳彈用：找離 from 最近、而且還沒被這串電到的敵人。
 * 必須排除已命中的，否則電流會在兩隻怪之間來回彈，同一隻被打好幾次。
 */
function nearestUnhit(
  state: BattleState,
  from: LiveEnemy,
  range: number,
  alreadyHit: Set<number>,
): LiveEnemy | null {
  let best: LiveEnemy | null = null;
  let bestDistance = Infinity;

  for (const candidate of findEnemiesInRadius(from, range, state.enemies)) {
    if (alreadyHit.has(candidate.uid)) continue;

    const d = distanceSquared(from, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }

  return best;
}

function applySlow(enemy: LiveEnemy, factor: number, durationMs: number): void {
  if (getEnemy(enemy.kind).slowImmune) return;
  enemy.slowMs = Math.max(enemy.slowMs, durationMs);
  enemy.slowFactor = Math.max(enemy.slowFactor, factor);
}

/** 持續傷害只留最強的一層，不疊加——不然一排毒塔會瞬間融掉 Boss。 */
function applyDot(
  enemy: LiveEnemy,
  dps: number,
  durationMs: number,
  color: string,
): void {
  if (dps >= enemy.dotDps) {
    enemy.dotDps = dps;
    enemy.dotColor = color;
  }
  enemy.dotMs = Math.max(enemy.dotMs, durationMs);
}

function hitEnemy(
  state: BattleState,
  level: CompiledLevel,
  tower: LiveTower,
  enemy: LiveEnemy,
  stats: TowerStats,
  secondaryElements: Element[],
  damageRatio: number,
): void {
  const spec = getEnemy(enemy.kind);
  const damage =
    computeDamage({
      stats,
      secondaryElements,
      enemyElement: spec.element,
      enemyArmor: spec.armor,
      enemyArmorShred: enemy.armorShred,
      enemyFlying: spec.flying === true,
    }) * damageRatio;

  tower.totalDamage += damage;
  enemy.flashMs = FLASH_MS;

  // 護盾先擋，擋不完的才扣血。
  const absorbed = Math.min(enemy.shieldHp, damage);
  enemy.shieldHp -= absorbed;
  enemy.hp -= damage - absorbed;

  if (enemy.hp <= 0) {
    killEnemy(state, level, enemy);
  }
}

/** 從世界移除並結算獎勵。給塔擊殺用；持續傷害走 defeatEnemy。 */
function killEnemy(
  state: BattleState,
  level: CompiledLevel,
  enemy: LiveEnemy,
): void {
  const index = state.enemies.findIndex((candidate) => candidate.uid === enemy.uid);
  if (index === -1) return;

  state.enemies.splice(index, 1);
  defeatEnemy(state, level, enemy, state.enemies);
}

/** 獎勵、特效、分裂。呼叫端負責把 enemy 從世界拿掉。 */
function defeatEnemy(
  state: BattleState,
  level: CompiledLevel,
  enemy: LiveEnemy,
  into: LiveEnemy[],
): void {
  const spec = getEnemy(enemy.kind);
  state.frosting += spec.reward;
  state.kills += 1;
  addEffect(state, "pop", enemy, spec.radius * 1.8, spec.palette.body);

  if (!spec.splitInto) return;

  for (let i = 0; i < spec.splitInto.count; i += 1) {
    const child = createEnemy(
      state,
      level,
      spec.splitInto.kind,
      enemy.pathIndex,
      Math.max(0, enemy.distance - i * 16),
    );
    // 分裂出來的小怪繼承減速，不然打破泡泡反而變成幫敵人解狀態。
    child.slowMs = enemy.slowMs;
    child.slowFactor = enemy.slowFactor;
    into.push(child);
  }
}

// === 波次進度 ===

function checkWaveComplete(state: BattleState, level: CompiledLevel): void {
  // 最後一隻怪偷走最後一塊蛋糕時，牠同時「離開了場上」也「打穿了櫃檯」。
  // 沒有這個防護的話，updateEnemies 剛判定輸掉，這裡又會把它改成通關。
  if (state.phase !== "wave") return;
  if (state.spawnQueue.length > 0 || state.enemies.length > 0) return;

  const wave = level.spec.waves[state.waveIndex];
  state.frosting += wave?.bonus ?? 0;

  // 連擊是「一直打同一隻」的獎勵，一波打完就該歸零。塔在準備階段不會 tick，
  // 不在這裡清的話會把上一波的連段帶進下一波。
  for (const tower of state.towers) {
    tower.comboHits = 0;
    tower.comboTargetUid = 0;
  }

  const isLastWave = state.waveIndex >= level.spec.waves.length - 1;
  if (isLastWave) {
    state.phase = "cleared";
    return;
  }

  state.waveIndex += 1;
  state.phase = "prep";
  state.prepMs = PREP_MS;
}

// === 純視覺 ===

function spawnProjectile(
  state: BattleState,
  from: Vec2,
  to: Vec2,
  color: string,
  style: AttackStyle,
): void {
  const speed = PROJECTILE_SPEED[style];
  if (speed === 0) return;

  const travel = Math.hypot(to.x - from.x, to.y - from.y);
  state.projectiles.push({
    uid: state.nextUid++,
    style,
    x: from.x,
    y: from.y,
    targetX: to.x,
    targetY: to.y,
    progress: 0,
    speed,
    color,
    radius: style === "shard" ? 7 : style === "mortar" ? 6 : 4,
    // 迫擊砲彈走拋物線，其餘走直線。
    arc: style === "mortar" ? travel * 0.28 : 0,
  });
}

function addBeam(
  state: BattleState,
  points: Vec2[],
  color: string,
  width: number,
): void {
  state.beams.push({
    uid: state.nextUid++,
    points,
    color,
    width,
    ageMs: 0,
    lifeMs: BEAM_LIFE_MS,
  });
}

function addEffect(
  state: BattleState,
  kind: "splash" | "pop" | "heal" | "steal",
  at: Vec2,
  radius: number,
  color: string,
): void {
  state.effects.push({
    uid: state.nextUid++,
    kind,
    x: at.x,
    y: at.y,
    radius,
    ageMs: 0,
    lifeMs: EFFECT_LIFE_MS[kind],
    color,
  });
}

/** 推進不影響勝負的東西：彈道、光束、特效、閃白、後座力。 */
function advanceVisuals(state: BattleState, dtMs: number): void {
  const dtSeconds = dtMs / 1000;

  state.projectiles = state.projectiles.filter((projectile) => {
    const travel = Math.hypot(
      projectile.targetX - projectile.x,
      projectile.targetY - projectile.y,
    );
    const step = travel === 0 ? 1 : (projectile.speed * dtSeconds) / travel;
    projectile.progress += step;
    return projectile.progress < 1;
  });

  state.beams = state.beams.filter((beam) => {
    beam.ageMs += dtMs;
    return beam.ageMs < beam.lifeMs;
  });

  state.effects = state.effects.filter((effect) => {
    effect.ageMs += dtMs;
    return effect.ageMs < effect.lifeMs;
  });

  for (const enemy of state.enemies) {
    enemy.flashMs = Math.max(0, enemy.flashMs - dtMs);
  }
  for (const tower of state.towers) {
    tower.recoilMs = Math.max(0, tower.recoilMs - dtMs);
  }
}
