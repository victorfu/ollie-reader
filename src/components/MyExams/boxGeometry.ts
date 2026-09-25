import { MIN_BOX_SIZE } from "../../constants/questionBank";
import type { Box } from "../../types/questionBank";

export interface Point {
  x: number;
  y: number;
}

export type Corner = "nw" | "ne" | "sw" | "se";

const EPSILON = 1e-9;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 兩個拖拉點（任意方向）→ 夾在 0–1 內、寬高為正的框。 */
export function boxFromPoints(a: Point, b: Point): Box {
  const left = clamp01(Math.min(a.x, b.x));
  const top = clamp01(Math.min(a.y, b.y));
  const right = clamp01(Math.max(a.x, b.x));
  const bottom = clamp01(Math.max(a.y, b.y));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function isBoxTooSmall(box: Box): boolean {
  return box.w < MIN_BOX_SIZE || box.h < MIN_BOX_SIZE;
}

/** 平移；整個框保持在 0–1 內（貼邊就停，不縮小）。 */
export function moveBox(box: Box, dx: number, dy: number): Box {
  return {
    ...box,
    x: Math.min(1 - box.w, Math.max(0, box.x + dx)),
    y: Math.min(1 - box.h, Math.max(0, box.y + dy)),
  };
}

/** 把某個角拖到 point；對角固定。拖過頭會翻轉，結果仍是正規化的框。 */
export function resizeBox(box: Box, corner: Corner, point: Point): Box {
  const fixed: Point = {
    x: corner === "nw" || corner === "sw" ? box.x + box.w : box.x,
    y: corner === "nw" || corner === "ne" ? box.y + box.h : box.y,
  };
  return boxFromPoints(fixed, point);
}

export function sameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.w - b.w) < EPSILON &&
    Math.abs(a.h - b.h) < EPSILON
  );
}

/** clientX／clientY → 以 rect 為基準的 0–1 座標（未夾制）。 */
export function toRelativePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): Point {
  return {
    x: rect.width > 0 ? (clientX - rect.left) / rect.width : 0,
    y: rect.height > 0 ? (clientY - rect.top) / rect.height : 0,
  };
}
