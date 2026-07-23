import { describe, expect, it } from "vitest";
import { drawSpawnHint, renderBattle } from "./renderer";
import { compileLevel, createBattle, stepSimulation } from "../engine/simulation";
import { LEVELS } from "../data/levels";
import { ENEMIES } from "../data/enemies";
import { STEP_MS } from "../constants";
import type { BattleState, EnemyKind, LiveEnemy } from "../types";

/**
 * 記錄型的假 canvas context。
 *
 * jsdom 沒有真的 2D context，而繪製程式碼裡的錯字（打錯方法名、傳錯參數個數）
 * TypeScript 抓不到——真正跑起來才會炸。這個 stub 讓繪製流程能在測試裡整條跑
 * 過，順便確認每隻怪、每座塔都真的有下繪製指令。
 */
function createRecordingContext() {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.length})`);
    };

  const ctx = {
    calls,
    canvas: { width: 960, height: 540 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    lineCap: "butt",
    lineJoin: "miter",
    save: record("save"),
    restore: record("restore"),
    translate: record("translate"),
    setTransform: record("setTransform"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arc: record("arc"),
    arcTo: record("arcTo"),
    ellipse: record("ellipse"),
    quadraticCurveTo: record("quadraticCurveTo"),
    rect: record("rect"),
    fill: record("fill"),
    stroke: record("stroke"),
    fillRect: record("fillRect"),
    clearRect: record("clearRect"),
    fillText: record("fillText"),
    setLineDash: record("setLineDash"),
    drawImage: record("drawImage"),
  };

  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
}

const LEVEL = compileLevel(LEVELS[0]);

function makeEnemy(kind: EnemyKind, overrides: Partial<LiveEnemy> = {}): LiveEnemy {
  const spec = ENEMIES[kind];
  return {
    uid: 1,
    kind,
    hp: spec.hp,
    maxHp: spec.hp,
    shieldHp: 0,
    pathIndex: 0,
    distance: 100,
    remaining: 500,
    x: 200,
    y: 150,
    slowMs: 0,
    slowFactor: 0,
    stunMs: 0,
    dotDps: 0,
    dotMs: 0,
    dotColor: "#7ac77a",
    armorShred: 0,
    nextSummonMs: 0,
    nextShieldMs: 0,
    flashMs: 0,
    ...overrides,
  };
}

function emptyView() {
  return {
    selectedSlotId: null,
    hoveredSlotId: null,
    previewPetId: null,
  };
}

describe("renderBattle", () => {
  it("draws an empty prep-phase board without throwing", () => {
    const ctx = createRecordingContext();
    const state = createBattle(LEVEL, "normal", 1);

    expect(() => renderBattle(ctx, state, LEVEL, emptyView())).not.toThrow();
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it("draws every enemy shape without throwing", () => {
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const ctx = createRecordingContext();
      const state: BattleState = {
        ...createBattle(LEVEL, "normal", 1),
        enemies: [makeEnemy(kind)],
      };

      expect(
        () => renderBattle(ctx, state, LEVEL, emptyView()),
        `繪製 ${kind} 失敗`,
      ).not.toThrow();
    }
  });

  it("draws status rings for slowed, stunned and shielded enemies", () => {
    const ctx = createRecordingContext();
    const state: BattleState = {
      ...createBattle(LEVEL, "normal", 1),
      enemies: [
        makeEnemy("gumdrop", { uid: 1, slowMs: 500, slowFactor: 0.35 }),
        makeEnemy("gumdrop", { uid: 2, stunMs: 500, x: 260 }),
        makeEnemy("macaron-queen", { uid: 3, shieldHp: 200, x: 320 }),
        makeEnemy("chocolate", { uid: 4, hp: 10, flashMs: 60, x: 380 }),
      ],
    };

    expect(() => renderBattle(ctx, state, LEVEL, emptyView())).not.toThrow();
  });

  it("draws towers, projectiles and effects after a live battle step", () => {
    const state = createBattle(LEVEL, "normal", 1);
    stepSimulation(
      state,
      LEVEL,
      [
        { kind: "placeTower", slotId: "s1", petId: "nibi" },
        { kind: "placeTower", slotId: "s2", petId: "pico" },
        { kind: "startWave" },
      ],
      STEP_MS,
    );
    // 跑到塔真的開火為止，而不是猜一個秒數——第一波多久被清光會隨平衡調整而變。
    for (let i = 0; i < 60 * 30; i += 1) {
      stepSimulation(state, LEVEL, [], STEP_MS);
      if (state.enemies.length > 0 && state.projectiles.length > 0) break;
    }

    expect(state.towers).toHaveLength(2);
    expect(state.enemies.length).toBeGreaterThan(0);
    expect(state.projectiles.length).toBeGreaterThan(0);

    const busy = createRecordingContext();
    expect(() => renderBattle(busy, state, LEVEL, emptyView())).not.toThrow();

    // 圖片在 jsdom 裡永遠載不完，所以這裡走的是「還沒載到圖」的退路——正好順便
    // 確認退路本身畫得出東西。場上有東西時的繪製指令一定比空場多。
    const idle = createRecordingContext();
    renderBattle(idle, createBattle(LEVEL, "normal", 1), LEVEL, emptyView());

    expect(busy.calls.length).toBeGreaterThan(idle.calls.length);
  });

  it("draws the range preview for a selected slot, occupied or not", () => {
    const state = createBattle(LEVEL, "normal", 1);
    stepSimulation(
      state,
      LEVEL,
      [{ kind: "placeTower", slotId: "s1", petId: "lumi" }],
      STEP_MS,
    );

    const occupied = createRecordingContext();
    expect(() =>
      renderBattle(occupied, state, LEVEL, {
        selectedSlotId: "s1",
        hoveredSlotId: null,
        previewPetId: null,
      }),
    ).not.toThrow();

    const empty = createRecordingContext();
    expect(() =>
      renderBattle(empty, state, LEVEL, {
        selectedSlotId: "s4",
        hoveredSlotId: "s4",
        previewPetId: "momo",
      }),
    ).not.toThrow();
  });

  it("ignores a selected slot that no longer exists", () => {
    const ctx = createRecordingContext();
    const state = createBattle(LEVEL, "normal", 1);

    expect(() =>
      renderBattle(ctx, state, LEVEL, {
        selectedSlotId: "does-not-exist",
        hoveredSlotId: null,
        previewPetId: "lumi",
      }),
    ).not.toThrow();
  });
});

describe("drawSpawnHint", () => {
  it("marks the entrance without throwing", () => {
    const ctx = createRecordingContext();

    expect(() => drawSpawnHint(ctx, LEVEL, 1234)).not.toThrow();
    expect(ctx.calls.length).toBeGreaterThan(0);
  });
});
