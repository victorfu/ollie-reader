import type { ChangeEventHandler, DragEventHandler } from "react";

interface UploadAreaProps {
  selectedFile: File | null;
  isUploading: boolean;
  isLoadingFromUrl: boolean;
  urlInput: string;
  speechSupported: boolean;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onUrlChange: (url: string) => void;
  onUrlLoad: (url: string) => void;
  onCancel: () => void;
  onOpenBookingDrawer?: () => void;
}

export const UploadArea = ({
  selectedFile,
  isUploading,
  isLoadingFromUrl,
  urlInput,
  speechSupported,
  onFileChange,
  onDrop,
  onDragOver,
  onUrlChange,
  onUrlLoad,
  onCancel,
  onOpenBookingDrawer,
}: UploadAreaProps) => {
  return (
    <div className="card bg-base-100 shadow-xl mb-6">
      <div className="card-body p-4">
        {/* Compact single row layout */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          {/* URL Input */}
          <div className="join flex-1 w-full sm:w-auto">
            <input
              type="text"
              placeholder="輸入 PDF 網址"
              className="input input-bordered input-sm join-item flex-1 min-w-0"
              value={urlInput}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && urlInput.trim()) {
                  onUrlLoad(urlInput);
                }
              }}
              disabled={isLoadingFromUrl}
            />
            <button
              type="button"
              onClick={() => onUrlLoad(urlInput)}
              disabled={isLoadingFromUrl || !urlInput.trim()}
              className="btn btn-primary btn-sm join-item"
            >
              {isLoadingFromUrl ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                "載入"
              )}
            </button>
          </div>

          {/* Divider text */}
          <span className="text-base-content/50 text-sm hidden sm:inline">
            或
          </span>

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
              className={`btn btn-sm btn-outline gap-2 w-full sm:w-auto cursor-pointer ${
                selectedFile ? "btn-success" : ""
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
                  strokeWidth={2}
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
              className="btn btn-accent btn-sm text-white w-full sm:w-auto"
              onClick={onOpenBookingDrawer}
              aria-label="查看課程預約紀錄"
            >
              📚 課程紀錄
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
              className="btn btn-error btn-outline btn-sm"
            >
              取消
            </button>
          </div>
        )}

        {!speechSupported && (
          <div className="alert alert-warning mt-3 py-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-xs">您的瀏覽器不支援語音朗讀功能</span>
          </div>
        )}
      </div>
    </div>
  );
};
