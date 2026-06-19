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
  }: UploadAreaProps) => {
    return (
      <div className="surface-card rounded-xl mb-2 w-full sm:w-fit">
        <div className="p-4">
          {/* Compact single row layout */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* File Upload Button */}
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              className="w-full sm:w-auto"
            >
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
                className={`flex items-center justify-center gap-2 h-8 px-3 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 w-full sm:w-auto border shadow-soft hover:bg-base-200 active:scale-[0.98] ${
                  selectedFile
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-base-100 border-border-hairline text-base-content"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
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

            {/* 課程紀錄按鈕 */}
            {onOpenBookingDrawer && (
              <button
                type="button"
                className="btn btn-primary btn-sm w-full sm:w-auto"
                onClick={onOpenBookingDrawer}
                aria-label="查看課程預約紀錄"
              >
                課程紀錄
              </button>
            )}

            {/* 清除快取 */}
            {onClearCache && (
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
            )}
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
