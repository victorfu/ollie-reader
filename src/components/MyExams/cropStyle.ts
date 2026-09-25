import type { Box, SourcePage } from "../../types/questionBank";

export interface RegionImageStyle {
  width: string;
  height: string;
  left: string;
  top: string;
}

function percent(ratio: number): string {
  // 加 0 把 -0 轉成 0，輸出 "0%" 而不是 "-0%"
  return `${ratio * 100 + 0}%`;
}

/**
 * 容器的長寬比等於框的實際長寬比，因此以容器為基準：
 * 整頁圖寬 = 1/w、高 = 1/h，再往左上平移 x/w、y/h（spec §9）。
 */
export function regionImageStyle(box: Box): RegionImageStyle {
  return {
    width: percent(1 / box.w),
    height: percent(1 / box.h),
    left: percent(-box.x / box.w),
    top: percent(-box.y / box.h),
  };
}

export function regionAspectRatio(
  box: Box,
  page: Pick<SourcePage, "width" | "height">,
): number {
  return (box.w * page.width) / (box.h * page.height);
}

/** 卡片縮圖：限制寬度，讓高度不超過 maxHeightPx。 */
export function thumbnailMaxWidth(
  aspectRatio: number,
  maxHeightPx: number,
): string {
  return `min(100%, ${Math.round(maxHeightPx * aspectRatio)}px)`;
}

/** 列印：佔內容欄寬度的百分比（0–100，spec §12.2）。 */
export function printRegionWidthPercent(box: Box, scale: number): number {
  return Math.min(box.w * scale * 100, 100);
}
