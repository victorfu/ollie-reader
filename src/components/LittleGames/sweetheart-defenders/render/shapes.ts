import type { EnemyShape, EnemySpec } from "../types";

/**
 * 用 canvas 把糖果怪畫出來。
 *
 * 這是「等 AI 生圖之前的佔位」，但刻意畫成看得出是故意的風格，而不是灰色方塊：
 * 圓滑的糖果外型 + 大眼睛 + 腮紅，跟寵物圖的粉彩調性搭得起來。之後只要在
 * EnemySpec 填上 sprite，renderer 就會改畫圖片，這裡整包可以留著當退路。
 */
export function drawEnemyShape(
  ctx: CanvasRenderingContext2D,
  spec: EnemySpec,
  radius: number,
  /** 走路時的上下擺動相位（0–1） */
  wobble: number,
): void {
  const { body, shade, accent } = spec.palette;

  ctx.save();
  drawBody(ctx, spec.shape, radius, body, shade, accent, wobble);
  drawFace(ctx, spec.shape, radius);
  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape,
  r: number,
  body: string,
  shade: string,
  accent: string,
  wobble: number,
): void {
  ctx.fillStyle = body;
  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(1.5, r * 0.12);

  switch (shape) {
    case "gumdrop": {
      // 圓頂 + 外擴的裙襬
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.95, -r * 0.35, 0, -r);
      ctx.quadraticCurveTo(r * 0.95, -r * 0.35, r, r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 糖粒
      ctx.fillStyle = accent;
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 + wobble;
        ctx.beginPath();
        ctx.arc(
          Math.cos(angle) * r * 0.5,
          Math.sin(angle) * r * 0.45 - r * 0.1,
          r * 0.08,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      break;
    }

    case "pillow": {
      roundedRect(ctx, -r, -r * 0.72, r * 2, r * 1.44, r * 0.42);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.72);
      ctx.lineTo(-r * 0.6, r * 0.72);
      ctx.moveTo(r * 0.6, -r * 0.72);
      ctx.lineTo(r * 0.6, r * 0.72);
      ctx.stroke();
      break;
    }

    case "block": {
      roundedRect(ctx, -r * 0.92, -r * 0.92, r * 1.84, r * 1.84, r * 0.24);
      ctx.fill();
      ctx.stroke();
      // 巧克力的分割溝
      ctx.strokeStyle = shade;
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(0, r * 0.92);
      ctx.moveTo(-r * 0.92, 0);
      ctx.lineTo(r * 0.92, 0);
      ctx.stroke();
      break;
    }

    case "bubble": {
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 高光
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.4, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case "ghost": {
      // 上半圓 + 下襬波浪
      const wave = r * 0.18;
      ctx.beginPath();
      ctx.arc(0, -r * 0.1, r * 0.9, Math.PI, 0);
      ctx.lineTo(r * 0.9, r * 0.6);
      for (let i = 0; i < 3; i += 1) {
        const x1 = r * 0.9 - (r * 0.6 * (i * 2 + 1)) / 3;
        const x2 = r * 0.9 - (r * 0.6 * (i * 2 + 2)) / 3;
        ctx.quadraticCurveTo(x1, r * 0.6 + wave, x2, r * 0.6);
      }
      ctx.lineTo(-r * 0.9, r * 0.6);
      ctx.closePath();
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }

    case "swirl": {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 旋轉的糖漩渦
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.5, r * 0.18);
      ctx.beginPath();
      for (let t = 0; t < Math.PI * 3; t += 0.2) {
        const spiral = (t / (Math.PI * 3)) * r * 0.8;
        const angle = t + wobble * Math.PI * 2;
        const x = Math.cos(angle) * spiral;
        const y = Math.sin(angle) * spiral;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }

    case "dome": {
      // 布丁：上窄下寬的圓角梯形 + 頂上的焦糖
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.8);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.5, -r * 0.55, -r * 0.8);
      ctx.lineTo(r * 0.55, -r * 0.8);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.5, r, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.8, r * 0.55, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // 王冠
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.95);
      ctx.lineTo(-r * 0.25, -r * 1.35);
      ctx.lineTo(0, -r * 1.05);
      ctx.lineTo(r * 0.25, -r * 1.35);
      ctx.lineTo(r * 0.4, -r * 0.95);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case "tier": {
      // 三層蛋糕
      const layers = [
        { w: r * 1.9, h: r * 0.5, y: r * 0.5 },
        { w: r * 1.5, h: r * 0.5, y: 0 },
        { w: r * 1.05, h: r * 0.5, y: -r * 0.5 },
      ];
      for (const layer of layers) {
        roundedRect(ctx, -layer.w / 2, layer.y - layer.h / 2, layer.w, layer.h, r * 0.16);
        ctx.fill();
        ctx.stroke();
      }
      // 頂上的櫻桃
      ctx.fillStyle = "#e2547a";
      ctx.beginPath();
      ctx.arc(0, -r * 0.92, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

/** 大眼睛 + 腮紅，讓佔位圖形也有表情。 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape,
  r: number,
): void {
  const eyeY = shape === "tier" ? -r * 0.5 : shape === "dome" ? -r * 0.25 : -r * 0.08;
  const eyeDx = r * 0.34;
  const eyeR = Math.max(1.6, r * 0.2);

  ctx.fillStyle = "#ffffff";
  for (const dx of [-eyeDx, eyeDx]) {
    ctx.beginPath();
    ctx.arc(dx, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#3b2f37";
  for (const dx of [-eyeDx, eyeDx]) {
    ctx.beginPath();
    ctx.arc(dx, eyeY + eyeR * 0.12, eyeR * 0.52, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,140,170,0.45)";
  for (const dx of [-eyeDx * 1.7, eyeDx * 1.7]) {
    ctx.beginPath();
    ctx.ellipse(dx, eyeY + eyeR * 1.5, eyeR * 0.62, eyeR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
