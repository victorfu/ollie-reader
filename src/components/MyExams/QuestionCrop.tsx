import { useState, type MouseEvent } from "react";
import type { QuestionRegion, SourcePage } from "../../types/questionBank";
import {
  printRegionWidthPercent,
  regionAspectRatio,
  regionImageStyle,
  thumbnailMaxWidth,
} from "./cropStyle";

export type QuestionCropLayout =
  | { kind: "fill" }
  | { kind: "thumbnail"; maxHeightPx: number }
  | { kind: "print"; scale: number };

interface QuestionCropProps {
  regions: readonly QuestionRegion[];
  pages: readonly SourcePage[];
  urls: Readonly<Record<string, string>>;
  /** 列表用 lazy；列印頁必須用 eager，否則畫面外的圖不會載入（spec §9）。 */
  loading: "lazy" | "eager";
  layout: QuestionCropLayout;
  enhance?: boolean;
  onImageLoad?: (regionIndex: number) => void;
  onRetry?: (storagePath: string) => void;
}

function regionWidth(
  layout: QuestionCropLayout,
  aspectRatio: number,
  region: QuestionRegion,
): string {
  switch (layout.kind) {
    case "fill":
      return "100%";
    case "thumbnail":
      return thumbnailMaxWidth(aspectRatio, layout.maxHeightPx);
    case "print":
      return `${printRegionWidthPercent(region.box, layout.scale)}%`;
  }
}

export function QuestionCrop({
  regions,
  pages,
  urls,
  loading,
  layout,
  enhance = false,
  onImageLoad,
  onRetry,
}: QuestionCropProps) {
  const [failedPaths, setFailedPaths] = useState<ReadonlySet<string>>(() => new Set());

  const markFailed = (path: string) =>
    setFailedPaths((previous) => new Set(previous).add(path));

  const retry = (event: MouseEvent<HTMLButtonElement>, path: string) => {
    // 卡片外層可能是 <Link>，不要讓重試變成換頁
    event.preventDefault();
    event.stopPropagation();
    setFailedPaths((previous) => {
      const next = new Set(previous);
      next.delete(path);
      return next;
    });
    onRetry?.(path);
  };

  return (
    <div className="flex w-full flex-col gap-1">
      {regions.map((region, regionIndex) => {
        const page = pages[region.pageIndex];
        if (!page) return null;
        const aspectRatio = regionAspectRatio(region.box, page);
        const imageStyle = regionImageStyle(region.box);
        const url = urls[page.storagePath];
        const failed = failedPaths.has(page.storagePath);

        return (
          <div
            key={regionIndex}
            data-testid="question-crop-region"
            className="relative overflow-hidden bg-white"
            style={{ aspectRatio, width: regionWidth(layout, aspectRatio, region) }}
          >
            {failed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-base-200 text-xs text-base-content/70">
                <span>圖片載入失敗</span>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={(event) => retry(event, page.storagePath)}
                >
                  重試
                </button>
              </div>
            ) : url ? (
              <>
                <img
                  src={url}
                  alt=""
                  loading={loading}
                  decoding="async"
                  draggable={false}
                  className={`absolute max-w-none select-none ${
                    enhance ? "grayscale contrast-130 brightness-105" : ""
                  }`}
                  style={imageStyle}
                  onLoad={() => onImageLoad?.(regionIndex)}
                  onError={() => markFailed(page.storagePath)}
                />
                <svg
                  className="pointer-events-none absolute [print-color-adjust:exact]"
                  style={imageStyle}
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {page.masks.map((mask, maskIndex) => (
                    <rect
                      key={maskIndex}
                      x={mask.x}
                      y={mask.y}
                      width={mask.w}
                      height={mask.h}
                      fill="white"
                    />
                  ))}
                </svg>
              </>
            ) : (
              <div className="absolute inset-0 animate-pulse bg-base-200" />
            )}
          </div>
        );
      })}
    </div>
  );
}
