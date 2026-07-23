import {
  HEIGHT,
  SLOT_RADIUS,
  TOWER_SPRITE_SIZE,
  WIDTH,
  PATH_WIDTH,
} from "../constants";
import { ELEMENT_COLOR } from "../data/elements";
import { getEnemy } from "../data/enemies";
import { getCharacter } from "../data/characters";
import { getTowerStats } from "../engine/combat";
import type { CompiledLevel } from "../engine/simulation";
import { pointAtDistance } from "../engine/path";
import type { BattleState, LiveEnemy, Vec2 } from "../types";
import { drawEnemyShape, roundedRect } from "./shapes";
import { getSprite } from "./sprites";

export type ViewState = {
  /** 被點開的塔位；會畫出射程圈 */
  selectedSlotId: string | null;
  /** 滑鼠停在哪個塔位 */
  hoveredSlotId: string | null;
  /** 正在挑選要放的角色；用來預覽射程 */
  previewCharacterId: string | null;
};

export function renderBattle(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  level: CompiledLevel,
  view: ViewState,
): void {
  const { theme } = level.spec;

  drawFloor(ctx, theme.floor, theme.floorEdge);
  drawPaths(ctx, level, theme.path, theme.pathEdge);
  drawCounter(ctx, level, state);
  drawSlots(ctx, state, level, view);
  drawEffects(ctx, state, "heal");
  drawEffects(ctx, state, "splash");
  drawEnemies(ctx, state);
  drawTowers(ctx, state, level);
  drawProjectiles(ctx, state);
  drawBeams(ctx, state);
  drawEffects(ctx, state, "pop");
  drawEffects(ctx, state, "steal");
  drawRangePreview(ctx, state, level, view);
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  floor: string,
  floorEdge: string,
): void {
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 淡淡的磁磚格線，讓大片地板不會太空。
  ctx.strokeStyle = floorEdge;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (let x = 80; x < WIDTH; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
  }
  for (let y = 80; y < HEIGHT; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPaths(
  ctx: CanvasRenderingContext2D,
  level: CompiledLevel,
  path: string,
  pathEdge: string,
): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const compiled of level.paths) {
    ctx.beginPath();
    compiled.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });

    ctx.strokeStyle = pathEdge;
    ctx.lineWidth = PATH_WIDTH;
    ctx.stroke();

    ctx.strokeStyle = path;
    ctx.lineWidth = PATH_WIDTH - 8;
    ctx.stroke();

    // 中線的虛線，讓行進方向看得出來
    ctx.strokeStyle = pathEdge;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** 路徑終點的櫃檯，上面擺著剩下的蛋糕。 */
function drawCounter(
  ctx: CanvasRenderingContext2D,
  level: CompiledLevel,
  state: BattleState,
): void {
  const points = level.paths[0].points;
  const end = points[points.length - 1];

  ctx.save();
  ctx.translate(end.x, end.y);

  ctx.fillStyle = "#f6e3cf";
  ctx.strokeStyle = "#cba985";
  ctx.lineWidth = 2;
  roundedRect(ctx, -58, -18, 116, 38, 10);
  ctx.fill();
  ctx.stroke();

  // 一塊小蛋糕代表一條命，最多畫 6 塊，其餘用數字補。
  const shown = Math.min(state.cakes, 6);
  for (let i = 0; i < shown; i += 1) {
    const x = -45 + i * 17;
    ctx.fillStyle = "#ffd3e2";
    roundedRect(ctx, x, -34, 13, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#e2547a";
    ctx.beginPath();
    ctx.arc(x + 6.5, -35, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.cakes > 6) {
    ctx.fillStyle = "#7a5b46";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`+${state.cakes - 6}`, 62, -20);
  }

  ctx.restore();
}

function drawSlots(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  level: CompiledLevel,
  view: ViewState,
): void {
  const occupied = new Set(state.towers.map((tower) => tower.slotId));

  for (const slot of level.spec.slots) {
    if (occupied.has(slot.id)) continue;

    const isHovered = view.hoveredSlotId === slot.id;
    const isSelected = view.selectedSlotId === slot.id;

    ctx.save();
    ctx.translate(slot.x, slot.y);

    ctx.fillStyle = isSelected
      ? "rgba(255,158,196,0.35)"
      : isHovered
        ? "rgba(255,255,255,0.75)"
        : "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(0, 0, SLOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isSelected ? "#ff6f9f" : "#c9b7a6";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, SLOT_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 空塔位的加號
    ctx.strokeStyle = isSelected ? "#ff6f9f" : "#bda993";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 7);
    ctx.stroke();

    ctx.restore();
  }
}

function drawTowers(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  level: CompiledLevel,
): void {
  for (const tower of state.towers) {
    const slot = level.slotById.get(tower.slotId);
    const pet = getCharacter(tower.characterId);
    if (!slot || !pet) continue;

    const element = pet.elements[0];
    // 開火後短暫放大，給一點「打出去了」的手感。
    const punch = 1 + (tower.recoilMs / 120) * 0.12;

    ctx.save();
    ctx.translate(slot.x, slot.y);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(0, 0, SLOT_RADIUS + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = ELEMENT_COLOR[element];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, SLOT_RADIUS + 4, 0, Math.PI * 2);
    ctx.stroke();

    const sprite = getSprite(pet.sprite);
    const size = TOWER_SPRITE_SIZE * punch;
    if (sprite) {
      const scale = size / Math.max(sprite.width, sprite.height);
      const w = sprite.width * scale;
      const h = sprite.height * scale;
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = ELEMENT_COLOR[element];
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // 等級圓點
    for (let i = 0; i < tower.level; i += 1) {
      ctx.fillStyle = "#ffb020";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-6 + i * 6, SLOT_RADIUS + 8, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, state: BattleState): void {
  for (const enemy of state.enemies) {
    const spec = getEnemy(enemy.kind);
    const wobblePhase = (state.timeMs / 320 + enemy.uid * 0.7) % (Math.PI * 2);
    const bob =
      enemy.stunMs > 0 ? 0 : Math.sin(wobblePhase) * spec.radius * 0.1;

    ctx.save();
    ctx.translate(enemy.x, enemy.y + bob);

    if (spec.flying) {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.ellipse(
        0,
        spec.radius * 1.5,
        spec.radius * 0.7,
        spec.radius * 0.22,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    const sprite = spec.sprite ? getSprite(spec.sprite) : null;
    if (sprite) {
      const size = spec.radius * 2.4;
      const scale = size / Math.max(sprite.width, sprite.height);
      ctx.drawImage(
        sprite,
        (-sprite.width * scale) / 2,
        (-sprite.height * scale) / 2,
        sprite.width * scale,
        sprite.height * scale,
      );
    } else {
      drawEnemyShape(ctx, spec, spec.radius, wobblePhase / (Math.PI * 2));
    }

    // 受擊閃白
    if (enemy.flashMs > 0) {
      ctx.globalAlpha = (enemy.flashMs / 90) * 0.65;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, spec.radius * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    drawStatusRing(ctx, enemy, spec.radius);
    ctx.restore();

    drawHealthBar(ctx, enemy, spec.radius);
  }
}

/** 減速畫藍圈、暈眩畫紫圈、護盾畫外框。 */
function drawStatusRing(
  ctx: CanvasRenderingContext2D,
  enemy: LiveEnemy,
  radius: number,
): void {
  if (enemy.shieldHp > 0) {
    ctx.strokeStyle = "rgba(150,200,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.dotMs > 0) {
    // 中毒 / 燒傷：沿著身體邊緣點一圈小點
    ctx.fillStyle = enemy.dotColor;
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        Math.cos(angle) * radius * 1.1,
        Math.sin(angle) * radius * 1.1,
        radius * 0.13,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  if (enemy.stunMs > 0) {
    ctx.strokeStyle = "rgba(195,156,240,0.95)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (enemy.slowMs > 0) {
    ctx.strokeStyle = "rgba(91,184,232,0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  enemy: LiveEnemy,
  radius: number,
): void {
  if (enemy.hp >= enemy.maxHp && enemy.shieldHp <= 0) return;

  const width = Math.max(24, radius * 2);
  const height = 4;
  const x = enemy.x - width / 2;
  const y = enemy.y - radius - 12;
  const ratio = Math.max(0, enemy.hp / enemy.maxHp);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  roundedRect(ctx, x, y, width, height, 2);
  ctx.fill();

  ctx.fillStyle =
    ratio > 0.5 ? "#67c96a" : ratio > 0.25 ? "#f2b544" : "#ef5f6b";
  roundedRect(ctx, x, y, width * ratio, height, 2);
  ctx.fill();
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
): void {
  for (const projectile of state.projectiles) {
    const t = Math.min(1, projectile.progress);
    const x = projectile.x + (projectile.targetX - projectile.x) * t;
    // 拋物線：飛到一半時最高。
    const lift = projectile.arc * Math.sin(Math.PI * t);
    const y = projectile.y + (projectile.targetY - projectile.y) * t - lift;

    ctx.save();
    ctx.fillStyle = projectile.color;

    switch (projectile.style) {
      case "bolt": {
        // 又細又快的電光，帶一小段拖尾
        const tailX = x - (projectile.targetX - projectile.x) * 0.05;
        const tailY = y - (projectile.targetY - projectile.y) * 0.05;
        ctx.strokeStyle = projectile.color;
        ctx.lineWidth = projectile.radius * 0.9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.stroke();
        break;
      }

      case "syrupBlob": {
        // 黏稠的球，飛行時上下晃
        const wobble = Math.sin(t * Math.PI * 4) * projectile.radius * 0.35;
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          projectile.radius * 1.2,
          projectile.radius + wobble,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        break;
      }

      case "note": {
        // 飄上去的音符：一個實心頭 + 一根桿子
        ctx.globalAlpha = 1 - t * 0.4;
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          projectile.radius,
          projectile.radius * 0.8,
          -0.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.strokeStyle = projectile.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x + projectile.radius * 0.8, y);
        ctx.lineTo(x + projectile.radius * 0.8, y - projectile.radius * 2.4);
        ctx.stroke();
        break;
      }

      case "mortar": {
        // 砲彈本體 + 地面上的落點影子
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.ellipse(
          projectile.x + (projectile.targetX - projectile.x) * t,
          projectile.y + (projectile.targetY - projectile.y) * t,
          projectile.radius * 1.1,
          projectile.radius * 0.4,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case "shard": {
        // 又大又鈍的晶石，邊飛邊轉
        ctx.translate(x, y);
        ctx.rotate(t * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, -projectile.radius);
        ctx.lineTo(projectile.radius * 0.7, 0);
        ctx.lineTo(0, projectile.radius);
        ctx.lineTo(-projectile.radius * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }

      default: {
        ctx.beginPath();
        ctx.arc(x, y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
}

/** 狙擊的光束與連鎖的跳彈：瞬間畫一條折線，然後很快淡掉。 */
function drawBeams(ctx: CanvasRenderingContext2D, state: BattleState): void {
  for (const beam of state.beams) {
    if (beam.points.length < 2) continue;

    const fade = 1 - beam.ageMs / beam.lifeMs;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 外層寬一點、比較透明，內層細一點、接近白色，看起來才會亮。
    ctx.globalAlpha = fade * 0.55;
    ctx.strokeStyle = beam.color;
    ctx.lineWidth = beam.width * 2.4;
    strokePolyline(ctx, beam.points);

    ctx.globalAlpha = fade;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = beam.width;
    strokePolyline(ctx, beam.points);

    ctx.restore();
  }
}

function strokePolyline(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  kind: "splash" | "pop" | "steal" | "heal",
): void {
  for (const effect of state.effects) {
    if (effect.kind !== kind) continue;

    const progress = effect.ageMs / effect.lifeMs;

    if (kind === "steal") {
      // 被偷蛋糕時往上飄的紅色驚嘆號
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = effect.color;
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🍰", effect.x, effect.y - progress * 26);
      ctx.globalAlpha = 1;
      continue;
    }

    if (kind === "heal") {
      // 應援塔的光環：一圈往外擴的細環，不要用實心蓋住底下的塔
      ctx.globalAlpha = (1 - progress) * 0.5;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        effect.x,
        effect.y,
        effect.radius * (0.35 + progress * 0.65),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }

    if (kind === "pop") {
      drawCrumbs(ctx, effect, progress);
      continue;
    }

    ctx.globalAlpha = (1 - progress) * 0.35;
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.arc(
      effect.x,
      effect.y,
      effect.radius * (0.5 + progress * 0.6),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

const CRUMB_COUNT = 7;

/**
 * 糖果碎屑。
 *
 * 位置完全由 effect 的 uid 推導出來，所以不需要在 BattleState 裡養一份粒子
 * 陣列——模擬層乾淨、存檔小、測試也不用管它。每隻怪的 uid 不同，噴出來的
 * 方向自然就不一樣。
 */
function drawCrumbs(
  ctx: CanvasRenderingContext2D,
  effect: BattleState["effects"][number],
  progress: number,
): void {
  // 先快後慢，像真的被彈飛出去。
  const eased = 1 - (1 - progress) * (1 - progress);
  const fade = 1 - progress;

  ctx.save();
  ctx.fillStyle = effect.color;
  ctx.globalAlpha = fade;

  for (let i = 0; i < CRUMB_COUNT; i += 1) {
    // uid 當亂數種子：同一個爆點每幀算出來都一樣，不同爆點又各自不同。
    const seed = effect.uid * 37 + i * 61;
    const angle = ((seed % 360) / 360) * Math.PI * 2;
    const reach = effect.radius * (0.7 + ((seed % 7) / 7) * 0.8);
    const size = 1.6 + ((seed % 5) / 5) * 2.2;

    const x = effect.x + Math.cos(angle) * reach * eased;
    // 加一點重力，碎屑會往下掉而不是平平散開。
    const y =
      effect.y + Math.sin(angle) * reach * eased + progress * progress * 14;

    ctx.beginPath();
    ctx.arc(x, y, size * fade, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** 選到某個塔位時畫出射程圈：已有塔就看塔的，還沒放就預覽要放的那隻。 */
function drawRangePreview(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  level: CompiledLevel,
  view: ViewState,
): void {
  if (!view.selectedSlotId) return;

  const slot = level.slotById.get(view.selectedSlotId);
  if (!slot) return;

  const tower = state.towers.find((t) => t.slotId === view.selectedSlotId);
  const pet = tower
    ? getCharacter(tower.characterId)
    : view.previewCharacterId
      ? getCharacter(view.previewCharacterId)
      : null;
  if (!pet) return;

  const stats = getTowerStats(pet, tower?.level ?? 1);

  ctx.fillStyle = "rgba(255,158,196,0.14)";
  ctx.beginPath();
  ctx.arc(slot.x, slot.y, stats.range, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,111,159,0.75)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(slot.x, slot.y, stats.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** 準備階段在路徑起點畫個箭頭，提示怪會從哪裡進來。 */
export function drawSpawnHint(
  ctx: CanvasRenderingContext2D,
  level: CompiledLevel,
  timeMs: number,
): void {
  for (const compiled of level.paths) {
    const pulse = (timeMs / 900) % 1;
    const point = pointAtDistance(compiled, pulse * 70);

    ctx.globalAlpha = 0.8 - pulse * 0.6;
    ctx.fillStyle = "#ff6f9f";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
