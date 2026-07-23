/**
 * 圖片快取。第一次要用某張圖時開始載入，載完之前先回傳 null，
 * renderer 會改畫佔位圖形——所以畫面永遠不會因為圖還沒到就卡住。
 */
const cache = new Map<string, HTMLImageElement>();
const ready = new Set<string>();
const failed = new Set<string>();

export function getSprite(url: string): HTMLImageElement | null {
  if (failed.has(url)) return null;
  if (ready.has(url)) return cache.get(url) ?? null;

  if (!cache.has(url)) {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => ready.add(url));
    image.addEventListener("error", () => failed.add(url));
    image.src = url;
    cache.set(url, image);
  }

  return null;
}

/** 進關卡前先把這一關會用到的圖排進載入佇列。 */
export function preloadSprites(urls: string[]): void {
  for (const url of urls) getSprite(url);
}
