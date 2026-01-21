import { memo, useEffect } from "react";
import type { BookingRecord } from "../../types/oikid";

interface BookingRecordsDrawerProps {
  isOpen: boolean;
  bookingRecords: BookingRecord[];
  loadingCourseId: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onSelectRecord: (record: BookingRecord) => void;
  onRetry: () => void;
}

export const BookingRecordsDrawer = memo(
  ({
    isOpen,
    bookingRecords,
    loadingCourseId,
    isLoading,
    error,
    onClose,
    onSelectRecord,
    onRetry,
  }: BookingRecordsDrawerProps) => {
    // ESC key to close
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
      <div className="fixed top-0 right-0 h-full z-50 flex flex-col pointer-events-none">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
          onClick={onClose}
        />
        {/* Drawer */}
        <aside
          role="complementary"
          aria-label="課程預約紀錄"
          className="absolute top-0 right-0 h-full w-80 bg-base-100/95 backdrop-blur-xl shadow-lg border-l border-black/5 dark:border-white/10 p-6 overflow-y-auto z-50 pointer-events-auto"
          style={{ maxWidth: 320 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-base-content">課程預約紀錄</h2>
            <button
              className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={onClose}
              aria-label="關閉"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <span className="loading loading-spinner loading-md text-primary"></span>
              <span className="mt-3 text-sm text-base-content/60">載入課程紀錄中...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-8">
              <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 mb-4 w-full">
                <p className="text-sm text-error">{error}</p>
              </div>
              <button
                className="btn btn-sm bg-base-100 border border-black/10 dark:border-white/10 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-200"
                onClick={onRetry}
              >
                重新載入
              </button>
            </div>
          ) : bookingRecords.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <p className="text-sm text-base-content/60 mb-4">目前沒有課程紀錄</p>
              <button
                className="btn btn-sm bg-base-100 border border-black/10 dark:border-white/10 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-200"
                onClick={onRetry}
              >
                重新載入
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {bookingRecords.map((record) => (
                <li key={record.id}>
                  <button
                    className={`w-full text-left p-3 rounded-lg border border-black/5 dark:border-white/10 flex flex-col hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-200 ${
                      loadingCourseId === record.id
                        ? "opacity-60 pointer-events-none"
                        : ""
                    }`}
                    onClick={() => onSelectRecord(record)}
                    disabled={loadingCourseId === record.id}
                  >
                    <span className="font-medium text-sm text-base-content/60">
                      Lv{record.Level}
                    </span>
                    <span className="font-semibold text-base text-base-content">
                      {record.CoursesName || record.OpenName}
                    </span>
                    <span className="text-sm text-base-content/70 mt-1">
                      {record.ClassTime}
                    </span>
                    <span className="text-sm text-base-content/50">
                      教師：{record.TeacherName}
                    </span>
                    {loadingCourseId === record.id && (
                      <span className="text-primary text-sm mt-1">載入中...</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    );
  }
);

BookingRecordsDrawer.displayName = "BookingRecordsDrawer";
