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

/** 糖霜池：淡藍色的一灘，邊緣有慢慢轉的光。站進去射程 +20%。 */
function drawSugarPool(
  ctx: CanvasRenderingContext2D,
  zone: SceneZone,
  timeMs: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 900);

  const fill = ctx.createRadialGradient(0, 0, zone.radius * 0.2, 0, 0, zone.radius);
  fill.addColorStop(0, "rgba(146, 214, 245, 0.42)");
  fill.addColorStop(1, "rgba(146, 214, 245, 0.08)");
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(91, 184, 232, ${0.35 + pulse * 0.3})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -timeMs / 60;
  ctx.stroke();
  ctx.setLineDash([]);
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
