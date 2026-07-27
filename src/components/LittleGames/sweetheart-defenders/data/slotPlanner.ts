import { HEIGHT, PATH_WIDTH, SLOT_RADIUS, WIDTH } from "../constants";
import { compilePath, distanceToPath, pointAtDistance } from "../engine/path";
import type { CompiledPath } from "../engine/path";
import type { SlotPlan, TowerSlot, Vec2 } from "../types";

/**
 * 塔位離路面中心多遠。
 *
 * 路面半寬 30 + 塔位半徑 28 = 58 就不會壓到路，再多 30px 留白，看起來才像
 * 「站在路邊」而不是「擠在路肩」。
 */
export const SLOT_OFFSET = 88;
/** 兩個塔位之間至少要隔這麼遠，不然轉角處會疊成一坨。 */
export const MIN_SLOT_SPACING = 112;
/** 塔位離畫面邊緣的最小距離。 */
export const EDGE_MARGIN = 34;
/** 小於這個距離就算壓在路上。 */
export const MIN_PATH_CLEARANCE = PATH_WIDTH / 2 + SLOT_RADIUS;

/** 理想位置站不了人時，往前後找替代點的搜尋間隔。 */
const SEARCH_STEP = 18;

/**
 * 沿著路徑排出塔位。
 *
 * 以前塔位是手打座標，只有「不壓路」「不出畫面」兩條規則擋著，所以
 * `{x:40, y:30}`（左上角，離路 300px 以上）這種一整場都在放空的位置也能過關。
 * 改成從路徑推導之後，每個塔位天生就貼著路——射程最短的藤蔓站上去也打得到。
 *
 * 作法是把 count 個塔位平均分佈在整條路的弧長上：第 i 個的理想位置在
 * (i + 0.5) / count 處，站不了人就往前後找替代點。純函式、沒有亂數，
 * 同樣的輸入永遠得到同樣的輸出。
 */
export function planSlots(paths: Vec2[][], plan: SlotPlan): TowerSlot[] {
  const compiled = paths.map(compilePath);
  const totalArc = compiled.reduce((sum, path) => sum + path.totalLength, 0);
  const gap = totalArc / plan.count;
  const accepted: Vec2[] = [];

  for (let index = 0; index < plan.count; index += 1) {
    const idealArc = (index + 0.5) * gap;
    // 左右交替，塔位才會排在路的兩側而不是全擠在同一邊。
    const preferredSide = index % 2 === 0 ? -1 : 1;
    const point = findSpot(compiled, paths, accepted, idealArc, preferredSide, gap);
    if (point) accepted.push(point);
  }

  return accepted.map((point, index) => ({
    id: `s${index + 1}`,
    x: Math.round(point.x),
    y: Math.round(point.y),
  }));
}

/**
 * 從理想弧長往外找第一個站得住的位置。
 *
 * 先試理想點的偏好側，再試另一側，然後才把搜尋範圍往前後擴大——這樣塔位會
 * 盡量待在它該待的位置，只有真的擠不下才挪開。
 */
function findSpot(
  compiled: CompiledPath[],
  paths: Vec2[][],
  accepted: Vec2[],
  idealArc: number,
  preferredSide: -1 | 1,
  gap: number,
): Vec2 | null {
  const sides: (-1 | 1)[] = [preferredSide, preferredSide === -1 ? 1 : -1];

  for (let drift = 0; drift <= gap * 0.75; drift += SEARCH_STEP) {
    for (const offset of drift === 0 ? [0] : [drift, -drift]) {
      for (const side of sides) {
        const candidate = pointBesidePath(compiled, idealArc + offset, side);
        if (candidate && isUsable(candidate, paths, accepted)) return candidate;
      }
    }
  }

  return null;
}

/**
 * 整體弧長 arc 處的路徑點，往側邊推 SLOT_OFFSET。
 * side = -1 是行進方向的左手邊，1 是右手邊。
 */
function pointBesidePath(
  compiled: CompiledPath[],
  arc: number,
  side: -1 | 1,
): Vec2 | null {
  let remaining = arc;
  for (const path of compiled) {
    if (remaining <= path.totalLength) {
      return offsetFromPath(path, remaining, side);
    }
    remaining -= path.totalLength;
  }
  return null;
}

function offsetFromPath(path: CompiledPath, travelled: number, side: -1 | 1): Vec2 {
  const here = pointAtDistance(path, travelled);
  // 用前後各一點算切線，轉角處才不會因為只看單一線段而歪掉。
  const ahead = pointAtDistance(path, Math.min(path.totalLength, travelled + 12));
  const behind = pointAtDistance(path, Math.max(0, travelled - 12));

  const dx = ahead.x - behind.x;
  const dy = ahead.y - behind.y;
  const length = Math.hypot(dx, dy) || 1;

  // 法線 = 切線轉 90°
  return {
    x: here.x + (-dy / length) * SLOT_OFFSET * side,
    y: here.y + (dx / length) * SLOT_OFFSET * side,
  };
}

function isUsable(point: Vec2, paths: Vec2[][], accepted: Vec2[]): boolean {
  if (
    point.x < EDGE_MARGIN ||
    point.x > WIDTH - EDGE_MARGIN ||
    point.y < EDGE_MARGIN ||
    point.y > HEIGHT - EDGE_MARGIN
  ) {
    return false;
  }

  // 推出去的方向可能正好撞上另一段路（折返段的對面），所以每條路都要驗。
  for (const path of paths) {
    if (distanceToPath(point, path) <= MIN_PATH_CLEARANCE) return false;
  }

  return accepted.every(
    (other) => Math.hypot(other.x - point.x, other.y - point.y) >= MIN_SLOT_SPACING,
  );
}

/**
 * 一個塔位的射程內涵蓋了多少路徑長度。
 *
 * 「離路夠近」還不足以說明塔位好用——貼在死巷口的塔位離路很近，但怪只會經過
 * 一瞬間。這個值算的是「怪會在我的射程裡走多久」，折返段中間的塔位會明顯較高。
 */
export function pathCoverage(slot: Vec2, paths: Vec2[][], range: number): number {
  const SAMPLE = 8;
  let covered = 0;

  for (const points of paths) {
    const path = compilePath(points);
    for (let travelled = 0; travelled < path.totalLength; travelled += SAMPLE) {
      const point = pointAtDistance(path, travelled);
      if (Math.hypot(point.x - slot.x, point.y - slot.y) <= range) covered += SAMPLE;
    }
  }

  return covered;
}
