import type { ExtractResponse } from "../../types/pdf";

interface FileInfoProps {
  result: ExtractResponse;
  onClearCache?: () => void;
  isClearingCache?: boolean;
}

export const FileInfo = ({
  result,
  onClearCache,
  isClearingCache,
}: FileInfoProps) => {
  return (
    <div className="stats stats-vertical sm:stats-horizontal shadow-xl w-full bg-base-100">
      <div className="stat">
        <div className="stat-figure text-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="inline-block w-8 h-8 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <div className="stat-title">檔案名稱</div>
        <div className="stat-value text-primary text-lg sm:text-2xl break-all">
          {result.filename}
        </div>
      </div>

      <div className="stat">
        <div className="stat-figure text-secondary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="inline-block w-8 h-8 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            ></path>
          </svg>
        </div>
        <div className="stat-title">總頁數</div>
        <div className="stat-value text-secondary">{result.total_pages}</div>
        <div className="stat-desc">已成功解析</div>
      </div>

      {onClearCache && (
        <div className="stat">
          <div className="stat-figure text-error">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block w-8 h-8 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <div className="stat-title">快取管理</div>
          <div className="stat-value">
            <button
              onClick={onClearCache}
              disabled={isClearingCache}
              className="btn btn-error btn-sm gap-2"
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
          </div>
          <div className="stat-desc">強制重新載入 PDF</div>
        </div>
      )}
    </div>
  );
};
