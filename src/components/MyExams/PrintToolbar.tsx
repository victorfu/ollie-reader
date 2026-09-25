import { ArrowLeft, Printer } from "lucide-react";
import {
  PRINT_SCALES,
  PRINT_SCALE_LABELS,
  type PrintPreferences,
} from "./printSettings";

interface PrintToolbarProps {
  onBack: () => void;
  onPrint: () => void;
  loadedCount: number;
  totalCount: number;
  preferences: PrintPreferences;
  onChange: (next: PrintPreferences) => void;
  hasAnswers: boolean;
  missingCount: number;
}

export function PrintToolbar({
  onBack,
  onPrint,
  loadedCount,
  totalCount,
  preferences,
  onChange,
  hasAnswers,
  missingCount,
}: PrintToolbarProps) {
  const ready = loadedCount >= totalCount;

  return (
    <div className="sticky top-0 z-10 mb-4 space-y-2 border-b border-base-300 bg-base-100/90 px-4 py-2 backdrop-blur-md print:hidden">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost btn-sm" aria-label="返回" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </button>

        <div className="join" role="group" aria-label="題目大小">
          {PRINT_SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              aria-pressed={preferences.scale === scale}
              className={`btn join-item btn-sm ${preferences.scale === scale ? "btn-primary" : ""}`}
              onClick={() => onChange({ ...preferences, scale })}
            >
              {PRINT_SCALE_LABELS[scale]}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            aria-label="列印增強"
            checked={preferences.enhance}
            onChange={(event) => onChange({ ...preferences, enhance: event.target.checked })}
          />
          列印增強
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            aria-label="附答案頁"
            checked={hasAnswers && preferences.includeAnswers}
            disabled={!hasAnswers}
            onChange={(event) => onChange({ ...preferences, includeAnswers: event.target.checked })}
          />
          附答案頁
        </label>

        <button type="button" className="btn btn-primary btn-sm ml-auto" disabled={!ready} onClick={onPrint}>
          {ready ? (
            <>
              <Printer className="size-4" />
              列印
            </>
          ) : (
            `圖片載入中 ${loadedCount}/${totalCount}`
          )}
        </button>
      </div>
      {missingCount > 0 && (
        <p className="mx-auto max-w-4xl text-sm text-warning">
          有 {missingCount} 題已從題庫刪除，列印時會略過。
        </p>
      )}
    </div>
  );
}
