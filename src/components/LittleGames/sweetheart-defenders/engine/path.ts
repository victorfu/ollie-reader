import type { Vec2 } from "../types";

/**
 * 敵人行進路線。折線在關卡資料裡是一串轉角點，這裡先算好累積距離，
 * 之後就能用「走了多遠」直接換算座標，不必每幀重走整條線。
 */
export type CompiledPath = {
  points: Vec2[];
  /** cumulative[i] = 從起點走到 points[i] 的距離 */
  cumulative: number[];
  totalLength: number;
};

export function compilePath(points: Vec2[]): CompiledPath {
  if (points.length < 2) {
    throw new Error("compilePath: 路徑至少要有兩個點");
  }

  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
    cumulative.push(total);
  }

  return { points, cumulative, totalLength: total };
}

/** 飛行怪不繞路，直接從起點飛到終點。 */
export function compileFlightPath(points: Vec2[]): CompiledPath {
  return compilePath([points[0], points[points.length - 1]]);
}

/** 走了 travelled 這麼遠時的座標。超出範圍會夾在頭尾。 */
export function pointAtDistance(path: CompiledPath, travelled: number): Vec2 {
  const { points, cumulative, totalLength } = path;

  if (travelled <= 0) return { ...points[0] };
  if (travelled >= totalLength) return { ...points[points.length - 1] };

  // 折線點數量不多（單關 10–20 個），線性掃描比二分搜尋簡單也夠快。
  let segment = 1;
  while (segment < cumulative.length - 1 && cumulative[segment] < travelled) {
    segment += 1;
  }

  const from = points[segment - 1];
  const to = points[segment];
  const segmentStart = cumulative[segment - 1];
  const segmentLength = cumulative[segment] - segmentStart;
  const t = segmentLength === 0 ? 0 : (travelled - segmentStart) / segmentLength;

  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * 一個點離整條路徑最近有多遠。
 *
 * 拿來檢查塔位有沒有壓在路面上——塔位如果太靠近路徑，畫面上會看起來像蓋在
 * 路中間，而且怪會從塔身上穿過去。
 */
export function distanceToPath(point: Vec2, points: Vec2[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    best = Math.min(best, distanceToSegment(point, points[i - 1], points[i]));
  }
  return best;
}

function distanceToSegment(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return distance(point, from);

  // 把點投影到線段上，再夾回 [0, 1] 之間，就是線段上最近的位置。
  const t = Math.max(
    0,
    Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared),
  );

  return distance(point, { x: from.x + t * dx, y: from.y + t * dy });
}

export function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}
