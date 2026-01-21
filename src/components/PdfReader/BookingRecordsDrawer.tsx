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
        <aside
          role="complementary"
          aria-label="課程預約紀錄"
          className="absolute top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto z-50 pointer-events-auto"
          style={{ maxWidth: 320 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">課程預約紀錄</h2>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={onClose}
              aria-label="關閉"
            >
              ✕
            </button>
          </div>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <span className="loading loading-spinner loading-md"></span>
              <span className="mt-2 text-gray-500">載入課程紀錄中...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button className="btn btn-sm btn-outline" onClick={onRetry}>
                重新載入
              </button>
            </div>
          ) : bookingRecords.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <p className="text-gray-500 mb-4">目前沒有課程紀錄</p>
              <button className="btn btn-sm btn-outline" onClick={onRetry}>
                重新載入
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {bookingRecords.map((record) => (
                <li key={record.id}>
                  <button
                    className={`w-full text-left p-3 rounded border flex flex-col hover:bg-blue-50 transition ${
                      loadingCourseId === record.id
                        ? "opacity-60 pointer-events-none"
                        : ""
                    }`}
                    onClick={() => onSelectRecord(record)}
                    disabled={loadingCourseId === record.id}
                  >
                    <span className="font-semibold text-base">
                      Lv{record.Level}
                    </span>
                    <span className="font-semibold text-base">
                      {record.CoursesName || record.OpenName}
                    </span>
                    <span className="text-sm text-gray-600">
                      {record.ClassTime}
                    </span>
                    <span className="text-sm text-gray-500">
                      教師：{record.TeacherName}
                    </span>
                    {loadingCourseId === record.id && (
                      <span className="text-blue-600 mt-1">載入中...</span>
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
