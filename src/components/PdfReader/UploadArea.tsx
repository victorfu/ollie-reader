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
}: UploadAreaProps) => {
  return (
    <div className="card bg-base-100 shadow-xl mb-6">
      <div className="card-body p-4 sm:p-6 lg:p-8">
        {/* URL Input Section */}
        <div className="mb-6">
          <label className="label">
            <span className="label-text font-semibold text-base">
              從網址載入 PDF
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="輸入 PDF 連結,例如:https://example.com/file.pdf"
              className="input input-bordered flex-1"
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
              className="btn btn-primary"
            >
              {isLoadingFromUrl ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  載入中
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  載入
                </>
              )}
            </button>
          </div>
        </div>

        <div className="divider">或</div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="border-2 border-dashed border-base-300 rounded-xl p-8 sm:p-12 hover:border-primary transition-colors cursor-pointer"
        >
          <input
            id="file"
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            className="hidden"
          />
          <label htmlFor="file" className="block cursor-pointer">
            <div className="text-center">
              <div className="text-5xl sm:text-6xl mb-4">📄</div>
              <div className="text-lg sm:text-xl font-semibold mb-2">
                {selectedFile ? (
                  <span className="text-primary">{selectedFile.name}</span>
                ) : (
                  "拖曳或點擊上傳 PDF"
                )}
              </div>
              <div className="text-sm text-base-content/60">
                支援格式:PDF (.pdf)
              </div>
            </div>
          </label>
        </div>

        {isUploading && (
          <div className="flex justify-center gap-3 mt-6">
            <button
              type="button"
              disabled
              className="btn btn-primary btn-lg gap-2"
            >
              <span className="loading loading-spinner"></span>
              解析中...
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-error btn-outline btn-lg"
            >
              取消
            </button>
          </div>
        )}

        {!speechSupported && (
          <div className="alert alert-warning mt-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
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
            <span>您的瀏覽器不支援語音朗讀功能</span>
          </div>
        )}
      </div>
    </div>
  );
};
