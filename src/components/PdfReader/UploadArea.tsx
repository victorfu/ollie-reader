import { memo } from "react";
import type { ChangeEventHandler, DragEventHandler } from "react";

interface UploadAreaProps {
  selectedFile: File | null;
  isUploading: boolean;
  speechSupported: boolean;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onCancel: () => void;
  onOpenBookingDrawer?: () => void;
  onClearCache?: () => void;
  isClearingCache?: boolean;
  /**
   * `card` is the standalone drop target shown before a PDF exists. `toolbar`
   * strips the card so the same controls can live inside the viewer's own
   * header row — two stacked bars cost ~116px of viewport, which is most of
   * what stops a whole page from fitting on a short screen.
   */
  variant?: "card" | "toolbar";
}

export const UploadArea = memo(
  ({
    selectedFile,
    isUploading,
    speechSupported,
    onFileChange,
    onDrop,
    onDragOver,
    onCancel,
    onOpenBookingDrawer,
    onClearCache,
    isClearingCache,
    variant = "card",
  }: UploadAreaProps) => {
    const isToolbar = variant === "toolbar";
    // In the card the controls own the full width of a phone; in the toolbar
    // they sit shoulder to shoulder and wrap instead.
    const blockWidth = isToolbar ? "" : "w-full sm:w-auto";

    const fileControl = (
      <div onDrop={onDrop} onDragOver={onDragOver} className={blockWidth}>
        <input
          key={selectedFile ? "has-file" : "no-file"}
          id="file"
          type="file"
          accept="application/pdf"
          onChange={onFileChange}
          className="hidden"
        />
        <label
          htmlFor="file"
          className={`flex items-center justify-center gap-2 h-8 px-3 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 border shadow-soft hover:bg-base-200 active:scale-[0.98] ${blockWidth} ${
            selectedFile
              ? "bg-success/10 border-success/30 text-success"
              : "bg-base-100 border-border-hairline text-base-content"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          {selectedFile ? (
            <span className="truncate max-w-32">{selectedFile.name}</span>
          ) : (
            "上傳 PDF"
          )}
        </label>
      </div>
    );

    const bookingButton = onOpenBookingDrawer && (
      <button
        type="button"
        className={`btn btn-primary btn-sm ${blockWidth}`}
        onClick={onOpenBookingDrawer}
        aria-label="查看課程預約紀錄"
      >
        課程紀錄
      </button>
    );

    const clearCacheButton = onClearCache && (
      <button
        type="button"
        onClick={onClearCache}
        disabled={isClearingCache}
        className="btn btn-ghost btn-sm text-error hover:bg-error/10"
        title="清除快取後需重新載入 PDF"
      >
        {isClearingCache ? (
          <span className="loading loading-spinner loading-xs"></span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        )}
      </button>
    );

    const speechWarningIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-warning shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    );

    if (isToolbar) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {fileControl}
          {bookingButton}
          {clearCacheButton}
          {isUploading && (
            <span className="flex items-center gap-1.5 text-xs text-base-content/70">
              <span className="loading loading-spinner loading-xs"></span>
              解析中
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-ghost btn-xs text-error hover:bg-error/10"
              >
                取消
              </button>
            </span>
          )}
          {/* The banner would cost another row of viewport here, so the same
              warning is carried by an icon with its text in the tooltip. */}
          {!speechSupported && (
            <span
              className="flex items-center"
              title="您的瀏覽器不支援語音朗讀功能"
              aria-label="您的瀏覽器不支援語音朗讀功能"
            >
              {speechWarningIcon}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="surface-card rounded-xl mb-2 w-full sm:w-fit">
        <div className="p-4">
          {/* Compact single row layout */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {fileControl}
            {bookingButton}
            {clearCacheButton}
          </div>

          {isUploading && (
            <div className="flex justify-center gap-3 mt-3">
              <button
                type="button"
                disabled
                className="btn btn-primary btn-sm gap-2"
              >
                <span className="loading loading-spinner loading-xs"></span>
                解析中...
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center justify-center h-8 px-3 rounded-lg text-sm font-medium border border-error/30 text-error bg-error/10 hover:bg-error/20 active:scale-[0.98] transition-all duration-200"
              >
                取消
              </button>
            </div>
          )}

          {!speechSupported && (
            <div className="rounded-lg bg-warning/10 border border-warning/20 px-4 py-3 mt-3 flex items-center gap-2">
              {speechWarningIcon}
              <span className="text-xs text-warning">
                您的瀏覽器不支援語音朗讀功能
              </span>
            </div>
          )}
        </div>
      </div>
    );
  },
);

UploadArea.displayName = "UploadArea";
