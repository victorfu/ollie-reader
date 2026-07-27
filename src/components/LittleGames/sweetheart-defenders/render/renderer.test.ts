import { describe, expect, it } from "vitest";
import { drawSpawnHint, renderBattle } from "./renderer";
import { compileLevel, createBattle, stepSimulation } from "../engine/simulation";
import { LEVELS } from "../data/levels";
import { ENEMIES } from "../data/enemies";
import { HEIGHT, STEP_MS, WIDTH } from "../constants";
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
    lineDashOffset: 0,
    save: record("save"),
    restore: record("restore"),
    translate: record("translate"),
    scale: record("scale"),
    rotate: record("rotate"),
    // 漸層要回傳一個還能繼續呼叫 addColorStop 的東西，不然場景層畫不下去。
    createRadialGradient: (...args: unknown[]) => {
      calls.push(`createRadialGradient(${args.length})`);
      return { addColorStop: record("addColorStop") };
    },
    createLinearGradient: (...args: unknown[]) => {
      calls.push(`createLinearGradient(${args.length})`);
      return { addColorStop: record("addColorStop") };
    },
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
    previewCharacterId: null,
  };
}

describe("renderBattle", () => {
  it("draws an empty prep-phase board without throwing", () => {
    const ctx = createRecordingContext();
    const state = createBattle(LEVEL, 1);

    expect(() => renderBattle(ctx, state, LEVEL, emptyView())).not.toThrow();
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it("draws every enemy shape without throwing", () => {
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const ctx = createRecordingContext();
      const state: BattleState = {
        ...createBattle(LEVEL, 1),
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
      ...createBattle(LEVEL, 1),
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
    const state = createBattle(LEVEL, 1);
    stepSimulation(
      state,
      LEVEL,
      [
        { kind: "placeTower", slotId: "s1", characterId: "minna-no-tabo" },
        { kind: "placeTower", slotId: "s2", characterId: "usahana" },
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
    renderBattle(idle, createBattle(LEVEL, 1), LEVEL, emptyView());

    expect(busy.calls.length).toBeGreaterThan(idle.calls.length);
  });

  it("draws the range preview for a selected slot, occupied or not", () => {
    const state = createBattle(LEVEL, 1);
    stepSimulation(
      state,
      LEVEL,
      [{ kind: "placeTower", slotId: "s1", characterId: "shiro" }],
      STEP_MS,
    );

    const occupied = createRecordingContext();
    expect(() =>
      renderBattle(occupied, state, LEVEL, {
        selectedSlotId: "s1",
        hoveredSlotId: null,
        previewCharacterId: null,
      }),
    ).not.toThrow();

    const empty = createRecordingContext();
    expect(() =>
      renderBattle(empty, state, LEVEL, {
        selectedSlotId: "s4",
        hoveredSlotId: "s4",
        previewCharacterId: "kuromi",
      }),
    ).not.toThrow();
  });

  it("ignores a selected slot that no longer exists", () => {
    const ctx = createRecordingContext();
    const state = createBattle(LEVEL, 1);

    expect(() =>
      renderBattle(ctx, state, LEVEL, {
        selectedSlotId: "does-not-exist",
        hoveredSlotId: null,
        previewCharacterId: "shiro",
      }),
    ).not.toThrow();
  });
});

/**
 * 櫃檯畫在路徑終點，而十二張地圖裡有十一張的終點都貼在畫布右緣（x≈1210）。
 * 任何「往櫃檯右邊再擺一點東西」的寫法都會被畫布裁掉——之前多出來的蛋糕數
 * 「+6」就是這樣被切成一根小黑槓掛在畫面邊上。生命是 12、櫃檯只畫 6 塊，
 * 所以那行字從每一關的第一幀就在畫面上。
 */
describe("counter overflow label", () => {
  /** 記下 fillText 的絕對座標與對齊方式，用來檢查字有沒有被畫出畫布。 */
  function createTextProbe() {
    const texts: { text: string; x: number; y: number; align: string }[] = [];
    let tx = 0;
    let ty = 0;
    const stack: number[][] = [];

    const base = createRecordingContext();
    const ctx = {
      ...base,
      textAlign: "left",
      save() {
        stack.push([tx, ty]);
      },
      restore() {
        const previous = stack.pop();
        if (previous) [tx, ty] = previous;
      },
      translate(x: number, y: number) {
        tx += x;
        ty += y;
      },
      fillText(text: string, x: number, y: number) {
        texts.push({ text, x: tx + x, y: ty + y, align: ctx.textAlign });
      },
    };

    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
  }

  // jsdom 沒有 measureText。實測 bold 12px system-ui 畫「+6」約 16.3px 寬，
  // 這裡取 24 當上限，涵蓋 "+12" 這種三個字元的情況。
  const LABEL_WIDTH = 24;

  function boxOf(entry: { x: number; align: string }) {
    if (entry.align === "center") {
      return [entry.x - LABEL_WIDTH / 2, entry.x + LABEL_WIDTH / 2];
    }
    if (entry.align === "right") return [entry.x - LABEL_WIDTH, entry.x];
    return [entry.x, entry.x + LABEL_WIDTH];
  }

  it("keeps the '+N' label fully on canvas on every map", () => {
    for (const spec of LEVELS) {
      const level = compileLevel(spec);
      const state = createBattle(level, 1);

      // 只有蛋糕多於畫得出來的 6 塊時才會有這行字；預設 12 條命一定會有。
      expect(state.cakes).toBeGreaterThan(6);

      const { ctx, texts } = createTextProbe();
      renderBattle(ctx, state, level, emptyView());

      const label = texts.find((entry) => entry.text.startsWith("+"));
      expect(label, `${spec.id} 少了多餘蛋糕的標籤`).toBeDefined();

      const [left, right] = boxOf(label!);
      expect(left, `${spec.id} 的「${label!.text}」超出畫布左緣`).toBeGreaterThanOrEqual(0);
      expect(right, `${spec.id} 的「${label!.text}」超出畫布右緣`).toBeLessThanOrEqual(WIDTH);
      expect(label!.y, `${spec.id} 的「${label!.text}」超出畫布上下緣`).toBeGreaterThanOrEqual(0);
      expect(label!.y).toBeLessThanOrEqual(HEIGHT);
    }
  });

  it("drops the label once six or fewer cakes are left", () => {
    const level = compileLevel(LEVELS[0]);
    const { ctx, texts } = createTextProbe();

    renderBattle(ctx, { ...createBattle(level, 1), cakes: 6 }, level, emptyView());

    expect(texts.filter((entry) => entry.text.startsWith("+"))).toHaveLength(0);
  });
});

describe("drawSpawnHint", () => {
  it("marks the entrance without throwing", () => {
    const ctx = createRecordingContext();

    expect(() => drawSpawnHint(ctx, LEVEL, 1234)).not.toThrow();
    expect(ctx.calls.length).toBeGreaterThan(0);
  });
});

/**
 * 糖果碎屑刻意不佔模擬狀態——位置全部由 effect 的 uid 推導。
 * 好處是存檔小、測試不用管；代價是這段推導只有繪製時才跑得到，所以要測。
 */
describe("candy crumbs on a defeated enemy", () => {
  function stateWithPop(uid: number, ageMs: number): BattleState {
    return {
      ...createBattle(LEVEL, 1),
      effects: [
        {
          uid,
          kind: "pop",
          x: 300,
          y: 200,
          radius: 24,
          ageMs,
          lifeMs: 350,
          color: "#a8e06a",
        },
      ],
    };
  }

  it("draws several crumbs rather than one blob", () => {
    const ctx = createRecordingContext();
    renderBattle(ctx, stateWithPop(1, 100), LEVEL, emptyView());

    const arcs = ctx.calls.filter((call) => call.startsWith("arc(")).length;
    const bare = createRecordingContext();
    renderBattle(bare, createBattle(LEVEL, 1), LEVEL, emptyView());
    const baseArcs = bare.calls.filter((call) => call.startsWith("arc(")).length;

    expect(arcs - baseArcs).toBeGreaterThanOrEqual(5);
  });

  it("stays deterministic for the same effect", () => {
    const first = createRecordingContext();
    const second = createRecordingContext();

    renderBattle(first, stateWithPop(42, 120), LEVEL, emptyView());
    renderBattle(second, stateWithPop(42, 120), LEVEL, emptyView());

    expect(second.calls).toEqual(first.calls);
  });

  it("survives the whole lifetime of the effect without throwing", () => {
    for (const ageMs of [0, 1, 175, 349]) {
      const ctx = createRecordingContext();
      expect(() =>
        renderBattle(ctx, stateWithPop(7, ageMs), LEVEL, emptyView()),
      ).not.toThrow();
    }
  });
});

describe("beams", () => {
  it("draws a sniper shot and a chain without throwing", () => {
    const ctx = createRecordingContext();
    const state: BattleState = {
      ...createBattle(LEVEL, 1),
      beams: [
        {
          uid: 1,
          points: [
            { x: 100, y: 100 },
            { x: 240, y: 160 },
          ],
          color: "#ffe8a3",
          width: 3.5,
          ageMs: 40,
          lifeMs: 160,
        },
        {
          uid: 2,
          points: [
            { x: 100, y: 100 },
            { x: 240, y: 160 },
            { x: 300, y: 210 },
            { x: 350, y: 190 },
          ],
          color: "#f7c948",
          width: 2.5,
          ageMs: 10,
          lifeMs: 160,
        },
      ],
    };

    expect(() => renderBattle(ctx, state, LEVEL, emptyView())).not.toThrow();
  });

  it("ignores a beam with too few points to draw a line", () => {
    const ctx = createRecordingContext();
    const state: BattleState = {
      ...createBattle(LEVEL, 1),
      beams: [
        {
          uid: 1,
          points: [{ x: 100, y: 100 }],
          color: "#fff",
          width: 3,
          ageMs: 0,
          lifeMs: 160,
        },
      ],
    };

    expect(() => renderBattle(ctx, state, LEVEL, emptyView())).not.toThrow();
  });
});
