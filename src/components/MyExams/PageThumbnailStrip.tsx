import type { SourcePage } from "../../types/questionBank";

interface PageThumbnailStripProps {
  pages: readonly SourcePage[];
  urls: Readonly<Record<string, string>>;
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function PageThumbnailStrip({
  pages,
  urls,
  currentIndex,
  onSelect,
  className = "",
}: PageThumbnailStripProps) {
  return (
    <nav aria-label="頁面" className={`max-h-[80vh] flex-col gap-2 overflow-y-auto ${className}`}>
      {pages.map((page, index) => {
        const url = urls[page.storagePath];
        const current = index === currentIndex;
        return (
          <button
            key={page.storagePath}
            type="button"
            aria-current={current ? "page" : undefined}
            className={`flex flex-col items-center gap-1 rounded-md border-2 p-0.5 ${
              current ? "border-primary" : "border-transparent hover:border-base-300"
            }`}
            onClick={() => onSelect(index)}
          >
            {url ? (
              <img src={url} alt={`第 ${index + 1} 頁`} loading="lazy" className="w-full rounded" />
            ) : (
              <div className="aspect-[3/4] w-full animate-pulse rounded bg-base-200" />
            )}
            <span className="text-xs">{index + 1}</span>
          </button>
        );
      })}
    </nav>
  );
}
