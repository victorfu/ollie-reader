import type { Enemy, Powerup } from "./types";

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

export function drawHero(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; w: number; h: number },
  inv: boolean,
  feather: boolean,
  dir: number,
  vy: number,
) {
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);

  // Squash and Stretch
  const stretch = Math.min(0.3, Math.abs(vy) / 1500);
  const scaleX = 1 - stretch * 0.5;
  const scaleY = 1 + stretch;
  ctx.scale(scaleX, scaleY);

  // Bobbing animation (idle)
  if (Math.abs(vy) < 50) {
    const bob = Math.sin(Date.now() / 150) * 2;
    ctx.translate(0, bob);
  }

  // Facing
  if (dir !== 0) {
    ctx.scale(dir, 1);
  }

  // Aura
  if (inv || feather) {
    ctx.fillStyle = inv
      ? "rgba(250, 204, 21, 0.4)"
      : "rgba(168, 85, 247, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Cinnamoroll Style Hero ---

  // Tail (Curly Cinnamon Roll)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-14, 6, 8, 0, Math.PI * 2);
  ctx.fill();
  // Tail swirl
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-14, 6, 4, 0, Math.PI * 1.5);
  ctx.stroke();

  // Body (White & Round)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet (Tiny white nubs)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-8, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(8, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head (Large White Oval)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, -4, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears (Long, Floppy, White)
  // Animate ears based on Y velocity
  const earAngle = Math.min(0.5, Math.max(-0.5, vy / 1000));
  ctx.fillStyle = "#fff";

  // Left Ear
  ctx.save();
  ctx.translate(-16, -10);
  ctx.rotate(-0.2 - earAngle);
  ctx.beginPath();
  ctx.ellipse(-12, 0, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right Ear
  ctx.save();
  ctx.translate(16, -10);
  ctx.rotate(0.2 + earAngle);
  ctx.beginPath();
  ctx.ellipse(12, 0, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Face
  // Eyes (Wide set, blue)
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.ellipse(-8, -2, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(8, -2, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlights
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-9, -4, 1, 0, Math.PI * 2);
  ctx.arc(7, -4, 1, 0, Math.PI * 2);
  ctx.fill();

  // Blush (Pink)
  ctx.fillStyle = "rgba(244, 114, 182, 0.5)";
  ctx.beginPath();
  ctx.ellipse(-12, 2, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(12, 2, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (Tiny 'w' or smile)
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 1, 3, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

export function drawPowerup(ctx: CanvasRenderingContext2D, pu: Powerup) {
  ctx.save();
  ctx.translate(pu.x, pu.y);

  // Float animation
  const floatY = Math.sin(Date.now() / 200) * 3;
  ctx.translate(0, floatY);

  // Glow
  const color =
    pu.type === "star"
      ? "#facc15"
      : pu.type === "feather"
      ? "#a855f7"
      : pu.type === "boot"
      ? "#22c55e"
      : "#ef4444";
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = color;

  if (pu.type === "star") {
    // Draw Star
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(
        Math.cos(((18 + i * 72) / 180) * Math.PI) * 10,
        -Math.sin(((18 + i * 72) / 180) * Math.PI) * 10,
      );
      ctx.lineTo(
        Math.cos(((54 + i * 72) / 180) * Math.PI) * 4,
        -Math.sin(((54 + i * 72) / 180) * Math.PI) * 4,
      );
    }
    ctx.closePath();
    ctx.fill();
  } else if (pu.type === "heart") {
    // Draw Heart
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-6, -4, -12, 4, 0, 12);
    ctx.bezierCurveTo(12, 4, 6, -4, 0, 4);
    ctx.fill();
  } else if (pu.type === "boot") {
    // Draw Boot
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(8, 4);
    ctx.quadraticCurveTo(8, 8, 4, 8);
    ctx.lineTo(-4, 8);
    ctx.closePath();
    ctx.fill();
  } else {
    // Draw Feather
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 10, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawMushroomEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

  // 衝刺視覺效果
  if (e.isCharging) {
    // 衝刺時的殘影/拖尾效果
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = e.type === "fast" ? "#3b82f6" : "#9333ea";
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(-e.dir * i * 8, 0, 16 - i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 衝刺時整體放大
    ctx.scale(1.15, 1.15);
  }

  // Stem
  ctx.fillStyle = "#fef3c7";
  roundRect(ctx, -10, 0, 20, 16, 4);

  // Cap Color based on type
  let capColor = "#ef4444"; // Normal (Red)
  if (e.type === "fast") capColor = "#3b82f6"; // Fast (Blue)
  if (e.type === "jumper") capColor = "#22c55e"; // Jumper (Green)
  if (e.type === "spiked") capColor = "#9333ea"; // Spiked (Purple)

  // Cap
  ctx.fillStyle = capColor;
  ctx.beginPath();
  ctx.arc(0, 0, 20, Math.PI, 0); // top half
  ctx.bezierCurveTo(20, 10, -20, 10, -20, 0);
  ctx.fill();

  // Spikes
  if (e.type === "spiked") {
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(-4, -28);
    ctx.lineTo(4, -28);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.lineTo(-20, -20);
    ctx.lineTo(-10, -22);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -14);
    ctx.lineTo(20, -20);
    ctx.lineTo(10, -22);
    ctx.fill();
  }

  // Spots
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(-10, -8, 4, 0, Math.PI * 2);
  ctx.arc(10, -6, 3, 0, Math.PI * 2);
  ctx.arc(0, -14, 3, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (Angry if spiked or charging)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  if (e.type === "spiked" || e.isCharging) {
    // Angry eyes for spiked or charging enemies
    ctx.moveTo(-8, 4);
    ctx.lineTo(-4, 8);
    ctx.lineTo(-8, 8);
    ctx.moveTo(8, 4);
    ctx.lineTo(4, 8);
    ctx.lineTo(8, 8);
    ctx.fill();
    // 衝刺時添加紅色瞳孔
    if (e.isCharging) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(-6, 6, 1.5, 0, Math.PI * 2);
      ctx.arc(6, 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.arc(-6, 6, 2, 0, Math.PI * 2);
    ctx.arc(6, 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wings for Jumper
  if (e.type === "jumper") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-22, -4, 8, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(22, -4, 8, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 26, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 26, y - 26, 26, Math.PI, Math.PI * 2);
  ctx.arc(x + 52, y, 26, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

// 教學告示牌：木牌立在地面，active 時上方顯示浮動對話泡泡
export function drawSign(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  text: string,
  active: boolean,
) {
  ctx.save();
  ctx.fillStyle = "#b45309";
  ctx.fillRect(x - 5, baseY - 66, 10, 66);
  ctx.fillStyle = "#d97706";
  roundRect(ctx, x - 26, baseY - 100, 52, 40, 8);
  ctx.fillStyle = "#fffbeb";
  ctx.font = "bold 22px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("！", x, baseY - 71);

  if (active) {
    const bob = Math.sin(performance.now() / 350) * 4;
    ctx.font = "bold 16px system-ui";
    const w = ctx.measureText(text).width + 28;
    const by = baseY - 140 + bob;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    roundRect(ctx, x - w / 2, by - 26, w, 38, 12);
    ctx.beginPath();
    ctx.moveTo(x - 8, by + 11);
    ctx.lineTo(x + 8, by + 11);
    ctx.lineTo(x, by + 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.fillText(text, x, by);
  }
  ctx.restore();
}

// 教學門：解鎖前的半透明斜紋屏障
export function drawGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  hint: string,
) {
  ctx.save();
  const top = 140;
  ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
  ctx.fillRect(x, top, 24, groundY - top);
  ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
  ctx.lineWidth = 4;
  for (let yy = top + 8; yy < groundY - 14; yy += 26) {
    ctx.beginPath();
    ctx.moveTo(x + 2, yy + 14);
    ctx.lineTo(x + 22, yy);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.font = "20px system-ui";
  ctx.fillStyle = "#475569";
  ctx.fillText("🔒", x + 12, top + 34);
  ctx.font = "bold 14px system-ui";
  const w = ctx.measureText(hint).width + 20;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, x + 12 - w / 2, top - 36, w, 26, 10);
  ctx.fillStyle = "#334155";
  ctx.fillText(hint, x + 12, top - 18);
  ctx.restore();
}

// 彈跳蘑菇（trampoline）：粉紅菇傘 + 白點，被踩到時擠壓回彈
export function drawSpring(
  ctx: CanvasRenderingContext2D,
  plat: { x: number; y: number; w: number; h: number; squash?: number },
) {
  ctx.save();
  const squashT = plat.squash ?? 0;
  const squash = 1 - Math.sin(Math.min(squashT / 0.25, 1) * Math.PI) * 0.35;
  const cx = plat.x + plat.w / 2;
  const capH = 18 * squash;
  const top = plat.y + plat.h - capH - 6;
  // 菇柄
  ctx.fillStyle = "#fef3c7";
  roundRect(ctx, cx - 8, plat.y + plat.h - 10, 16, 10, 4);
  // 菇傘
  ctx.fillStyle = "#fb7185";
  ctx.beginPath();
  ctx.ellipse(cx, top + capH, plat.w / 2, capH, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // 白點
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(cx - plat.w * 0.22, top + capH * 0.65, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + plat.w * 0.18, top + capH * 0.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
