import type { LevelSpec, SceneProp, SceneZone } from "../types";
import { roundedRect } from "./shapes";

/**
 * 場景層：地板上的裝飾與地形區。
 *
 * 十二張地圖以前只有「米色地板 + 格線 + 一條棕色折線」，換的只有 theme 顏色，
 * 所以每張圖看起來都一樣。道具全部用 canvas 畫，不載圖檔——形狀簡單、
 * 縮放不糊，也不用等圖下載完才有畫面。
 */

/** 裝飾畫在地板之上、路徑之下，怪走過去會蓋住道具的下緣，看起來才有前後。 */
export function drawProps(
  ctx: CanvasRenderingContext2D,
  spec: LevelSpec,
  timeMs: number,
): void {
  for (const prop of spec.props ?? []) {
    ctx.save();
    ctx.translate(prop.x, prop.y);
    ctx.scale((prop.flip ? -1 : 1) * (prop.scale ?? 1), prop.scale ?? 1);
    PROP_PAINTERS[prop.kind](ctx, timeMs, spec.theme.accent);
    ctx.restore();
  }
}

/** 地形區畫在路徑之上：玩家要看得出「這一圈跟別的地方不一樣」。 */
export function drawZones(
  ctx: CanvasRenderingContext2D,
  zones: SceneZone[],
  timeMs: number,
  zoneTimers: number[],
): void {
  zones.forEach((zone, index) => {
    ctx.save();
    ctx.translate(zone.x, zone.y);

    if (zone.kind === "sugarPool") drawSugarPool(ctx, zone, timeMs);
    else drawOvenVent(ctx, zone, zoneTimers[index] ?? 0);

    ctx.restore();
  });
}

/**
 * 糖霜池：潑在地上的一灘淡藍糖漿。站進去射程 +20%。
 *
 * 之前畫成「正圓 + 旋轉虛線」，跟空塔位、射程預覽是同一套 UI 虛線圈的視覺
 * 語言，玩家會把它讀成某種操作提示而不是地形。改成潑濺形：波浪邊緣、旁邊
 * 濺出去的小糖珠、糖面反光加閃爍糖粒——一眼就是「地上有一灘東西」。
 *
 * 波浪邊緣的幅度收在半徑 ±10% 內：加成判定用的是 zone.radius 的正圓
 * （compileLevel 的 rangeBonusBySlot），視覺形狀不能跟判定差太多。
 */
function drawSugarPool(
  ctx: CanvasRenderingContext2D,
  zone: SceneZone,
  timeMs: number,
): void {
  // 座標當種子：每一灘的形狀不同，但同一灘每一幀畫出來都一樣（不抖動）。
  const seed = (zone.x * 13 + zone.y * 7) % (Math.PI * 2);
  const edge = (angle: number) =>
    zone.radius *
    (0.96 +
      0.04 * Math.sin(angle * 3 + seed) +
      0.03 * Math.sin(angle * 5 + seed * 2) +
      // 邊緣像液面一樣慢慢起伏，幅度小到不會讓人懷疑範圍變了。
      0.015 * Math.sin(angle * 2 - timeMs / 1400));

  // 主體：光源偏左上（跟氣球、路燈的反光同一套），邊緣色深一點像有厚度。
  // 不透明度要夠高才像濃稠的糖霜——太透會變成一顆肥皂泡。
  const fill = ctx.createRadialGradient(
    -zone.radius * 0.18,
    -zone.radius * 0.22,
    zone.radius * 0.1,
    0,
    0,
    zone.radius,
  );
  fill.addColorStop(0, "rgba(200, 236, 252, 0.8)");
  fill.addColorStop(0.7, "rgba(160, 220, 247, 0.7)");
  fill.addColorStop(1, "rgba(120, 197, 238, 0.62)");
  ctx.fillStyle = fill;

  const tracePool = (scale: number) => {
    const STEPS = 48;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i += 1) {
      const angle = (i / STEPS) * Math.PI * 2;
      const r = edge(angle) * scale;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  tracePool(1);
  ctx.fill();

  // 實線的厚邊。不用虛線——虛線在這個遊戲裡是 UI 的專用語彙。
  ctx.strokeStyle = "rgba(91, 184, 232, 0.7)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // 內圈再疊一層淺色的小灘，糖漿才有「中間比較厚」的濃稠感。
  ctx.fillStyle = "rgba(226, 245, 253, 0.55)";
  ctx.save();
  ctx.translate(-zone.radius * 0.05, -zone.radius * 0.07);
  tracePool(0.72);
  ctx.fill();
  ctx.restore();

  // 濺出去的小糖珠，potch 一聲的那種感覺；位置吃種子，每灘不同。
  ctx.fillStyle = "rgba(178, 227, 249, 0.75)";
  ctx.strokeStyle = "rgba(91, 184, 232, 0.55)";
  ctx.lineWidth = 2;
  for (const [angleOffset, distanceRatio, sizeRatio] of [
    [0.9, 1.16, 0.07],
    [2.7, 1.2, 0.045],
    [4.4, 1.14, 0.055],
  ]) {
    const angle = seed + angleOffset;
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * zone.radius * distanceRatio,
      Math.sin(angle) * zone.radius * distanceRatio,
      zone.radius * sizeRatio,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
  }

  // 糖面的左上反光。
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.ellipse(
    -zone.radius * 0.32,
    -zone.radius * 0.38,
    zone.radius * 0.3,
    zone.radius * 0.14,
    -0.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // 糖粒：幾顆小菱形亮點輪流閃，「糖」霜的糖。
  for (let i = 0; i < 6; i += 1) {
    const angle = seed + (i / 6) * Math.PI * 2;
    const distance = zone.radius * (0.25 + (0.4 * ((i * 5) % 7)) / 7);
    const twinkle = 0.5 + 0.5 * Math.sin(timeMs / 650 + i * 1.9);
    const size = 2 + twinkle * 1.6;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    ctx.globalAlpha = 0.25 + twinkle * 0.55;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.55, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.55, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * 烤箱口：橘紅色的圈，快噴火時整個亮起來。
 *
 * 倒數最後一秒才變亮，玩家有時間反應「等一下這裡會燒起來」——地圖自己在
 * 做事，但不是偷襲。
 */
function drawOvenVent(
  ctx: CanvasRenderingContext2D,
  zone: SceneZone,
  msUntilFire: number,
): void {
  const charging = Math.max(0, 1 - msUntilFire / 1000);

  const fill = ctx.createRadialGradient(0, 0, zone.radius * 0.15, 0, 0, zone.radius);
  fill.addColorStop(0, `rgba(245, 138, 107, ${0.2 + charging * 0.45})`);
  fill.addColorStop(1, "rgba(245, 138, 107, 0.05)");
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(214, 92, 60, ${0.4 + charging * 0.5})`;
  ctx.lineWidth = 2 + charging * 3;
  ctx.stroke();

  // 中間的通風格柵，讓它看得出是個「出風口」而不是隨便一個圈。
  ctx.strokeStyle = "rgba(160, 74, 48, 0.55)";
  ctx.lineWidth = 3;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-zone.radius * 0.32, i * 9);
    ctx.lineTo(zone.radius * 0.32, i * 9);
    ctx.stroke();
  }
}

type Painter = (
  ctx: CanvasRenderingContext2D,
  timeMs: number,
  accent: string,
) => void;

const PROP_PAINTERS: Record<SceneProp["kind"], Painter> = {
  shopFront: (ctx, _t, accent) => {
    ctx.fillStyle = "#fff6ec";
    ctx.strokeStyle = "#d8bfa4";
    ctx.lineWidth = 2;
    roundedRect(ctx, -70, -80, 140, 90, 10);
    ctx.fill();
    ctx.stroke();

    // 窗
    ctx.fillStyle = "#e8f2f6";
    roundedRect(ctx, -52, -62, 44, 40, 6);
    ctx.fill();
    ctx.stroke();
    roundedRect(ctx, 8, -62, 44, 40, 6);
    ctx.fill();
    ctx.stroke();

    // 門
    ctx.fillStyle = accent;
    roundedRect(ctx, -16, -14, 32, 24, 5);
    ctx.fill();
  },

  awning: (ctx, _t, accent) => {
    // 條紋雨棚：一段一段畫，交替色
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? accent : "#fff6ec";
      ctx.beginPath();
      ctx.moveTo(-60 + i * 20, -14);
      ctx.lineTo(-40 + i * 20, -14);
      ctx.lineTo(-38 + i * 20, 12);
      ctx.lineTo(-58 + i * 20, 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-60, -14);
    ctx.lineTo(60, -14);
    ctx.stroke();
  },

  bench: (ctx) => {
    ctx.fillStyle = "#d7b48c";
    ctx.strokeStyle = "#b18f6a";
    ctx.lineWidth = 1.5;
    roundedRect(ctx, -34, -6, 68, 12, 5);
    ctx.fill();
    ctx.stroke();
    roundedRect(ctx, -34, -24, 68, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b18f6a";
    roundedRect(ctx, -28, 6, 6, 14, 2);
    ctx.fill();
    roundedRect(ctx, 22, 6, 6, 14, 2);
    ctx.fill();
  },

  planter: (ctx) => {
    ctx.fillStyle = "#c98f6b";
    roundedRect(ctx, -20, 0, 40, 22, 5);
    ctx.fill();
    ctx.fillStyle = "#7ac77a";
    for (const [dx, dy, r] of [
      [-9, -6, 11],
      [8, -8, 12],
      [0, -16, 10],
    ]) {
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  sakura: (ctx, timeMs) => {
    ctx.fillStyle = "#a9744f";
    roundedRect(ctx, -5, -6, 10, 34, 3);
    ctx.fill();

    ctx.fillStyle = "#ffd0e0";
    for (const [dx, dy, r] of [
      [-16, -18, 18],
      [15, -20, 17],
      [0, -34, 19],
      [-6, -10, 14],
    ]) {
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 飄落的花瓣：只吃 timeMs，不進模擬狀態
    ctx.fillStyle = "rgba(255, 175, 205, 0.85)";
    for (let i = 0; i < 3; i += 1) {
      const phase = (timeMs / 2600 + i * 0.37) % 1;
      ctx.beginPath();
      ctx.ellipse(
        -12 + i * 13 + Math.sin(phase * Math.PI * 4) * 7,
        -6 + phase * 46,
        3.4,
        2.2,
        phase * Math.PI * 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  },

  lamp: (ctx, _t, accent) => {
    ctx.fillStyle = "#b8a58f";
    roundedRect(ctx, -3, -30, 6, 44, 3);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -36, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(-3, -39, 4, 0, Math.PI * 2);
    ctx.fill();
  },

  cakeStand: (ctx, _t, accent) => {
    ctx.fillStyle = "#f3e0cd";
    ctx.strokeStyle = "#cba985";
    ctx.lineWidth = 1.5;
    roundedRect(ctx, -26, -4, 52, 8, 4);
    ctx.fill();
    ctx.stroke();
    roundedRect(ctx, -5, 4, 10, 16, 3);
    ctx.fill();
    ctx.stroke();
    roundedRect(ctx, -18, 20, 36, 7, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-10, -10, 7, 0, Math.PI * 2);
    ctx.arc(6, -11, 8, 0, Math.PI * 2);
    ctx.fill();
  },

  balloon: (ctx, timeMs, accent) => {
    // 上下浮動，讓靜態的場景有一點呼吸
    const bob = Math.sin(timeMs / 1100) * 5;

    ctx.strokeStyle = "rgba(120,100,90,0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.quadraticCurveTo(4, 10 + bob, 0, -2 + bob);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(0, -16 + bob, 14, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(-5, -22 + bob, 4, 5.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  },
};
