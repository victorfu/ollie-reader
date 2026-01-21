import { memo } from "react";
import type { ExtractResponse } from "../../types/pdf";

interface FileInfoProps {
  result: ExtractResponse;
  onClearCache?: () => void;
  isClearingCache?: boolean;
}

export const FileInfo = memo(
  ({ result, onClearCache, isClearingCache }: FileInfoProps) => {
    return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-base-100/80 backdrop-blur-xl shadow-lg w-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/5 dark:divide-white/10">
        {/* Filename */}
        <div className="p-4 flex items-center gap-4">
          <div className="text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="w-8 h-8 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-base-content/50 font-medium">檔案名稱</div>
            <div className="text-base font-semibold text-primary truncate">
              {result.filename}
            </div>
          </div>
        </div>

        {/* Page count */}
        <div className="p-4 flex items-center gap-4">
          <div className="text-secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="w-8 h-8 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              ></path>
            </svg>
          </div>
          <div>
            <div className="text-xs text-base-content/50 font-medium">總頁數</div>
            <div className="text-2xl font-semibold text-secondary">{result.total_pages}</div>
            <div className="text-xs text-base-content/40">已成功解析</div>
          </div>
        </div>

        {/* Clear cache */}
        {onClearCache && (
          <div className="p-4 flex items-center gap-4">
            <div className="text-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <div>
              <div className="text-xs text-base-content/50 font-medium">快取管理</div>
              <button
                onClick={onClearCache}
                disabled={isClearingCache}
                className="mt-1 flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium border border-error/30 text-error bg-error/10 hover:bg-error/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                title="清除快取後需重新載入 PDF"
              >
                {isClearingCache ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    清除中...
                  </>
                ) : (
                  <>清除快取</>
                )}
              </button>
              <div className="text-xs text-base-content/40 mt-1">強制重新載入 PDF</div>
            </div>
          </div>
        )}
      </div>
    </div>
    );
  }
);

FileInfo.displayName = "FileInfo";
