import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../utils/apiUtil";
import { OIKID_BOOKING_RECORDS_API_URL } from "../constants/api";
import type { BookingRecord, BookingRecordsResponse } from "../types/oikid";

interface UseBookingRecordsReturn {
  /** 預約記錄列表 */
  bookingRecords: BookingRecord[];
  /** API Token */
  token: string | null;
  /** 是否正在載入 */
  isLoading: boolean;
  /** 錯誤訊息 */
  error: string | null;
  /** 取得預約記錄 */
  fetchBookingRecords: () => Promise<void>;
  /** 清除錯誤訊息 */
  clearError: () => void;
}

/**
 * OiKID 預約記錄 Hook
 *
 * 使用 Firebase ID Token 驗證並取得使用者的課程預約記錄
 *
 * @example
 * ```tsx
 * const { bookingRecords, isLoading, error, fetchBookingRecords } = useBookingRecords();
 *
 * useEffect(() => {
 *   fetchBookingRecords();
 * }, []);
 *
 * if (isLoading) return <div>載入中...</div>;
 * if (error) return <div>錯誤: {error}</div>;
 *
 * return (
 *   <ul>
 *     {bookingRecords.map(record => (
 *       <li key={record.id}>{record.CoursesName} - {record.ClassTime}</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useBookingRecords(): UseBookingRecordsReturn {
  const [bookingRecords, setBookingRecords] = useState<BookingRecord[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookingRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 使用 apiFetch 並帶上 Firebase ID Token
      const response = await apiFetch(OIKID_BOOKING_RECORDS_API_URL, {
        method: "GET",
        includeAuthToken: true,
      });

      if (!response.ok) {
        throw new Error(`取得預約記錄失敗: ${response.status}`);
      }

      const data: BookingRecordsResponse = await response.json();

      // 設定 Token 和預約記錄
      setToken(data.Token || null);
      setBookingRecords(data.Data || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "取得預約記錄時發生未知錯誤";
      setError(message);
      console.error("Error fetching booking records:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 自動載入預約記錄
  useEffect(() => {
    fetchBookingRecords();
  }, [fetchBookingRecords]);

  return {
    bookingRecords,
    token,
    isLoading,
    error,
    fetchBookingRecords,
    clearError,
  };
}
