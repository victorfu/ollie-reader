import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch } from "../utils/apiUtil";
import { OIKID_BOOKING_RECORDS_API_URL } from "../constants/api";
import { isAbortError } from "../utils/errorUtils";
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

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 秒
  maxDelay: 5000, // 最大 5 秒
};

/**
 * OiKID 預約記錄 Hook
 *
 * 使用 Firebase ID Token 驗證並取得使用者的課程預約記錄
 * 包含自動重試機制以處理 serverless cold start
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBookingRecords = useCallback(async () => {
    // 取消之前的請求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      // 檢查是否已被取消
      if (controller.signal.aborted) return;

      try {
        const response = await apiFetch(OIKID_BOOKING_RECORDS_API_URL, {
          method: "GET",
          includeAuthToken: true,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`取得預約記錄失敗: ${response.status}`);
        }

        const data: BookingRecordsResponse = await response.json();

        // 檢查是否已被取消
        if (controller.signal.aborted) return;

        // 成功且有資料
        if (data.Data && data.Data.length > 0) {
          setToken(data.Token || null);
          setBookingRecords(data.Data);
          setIsLoading(false);
          return;
        }

        // 空資料，可能是 cold start，進行重試
        if (attempt < RETRY_CONFIG.maxRetries) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelay,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 重試完畢仍為空
        setToken(data.Token || null);
        setBookingRecords([]);
        setIsLoading(false);
        return;
      } catch (err: unknown) {
        // 忽略 abort 錯誤
        if (isAbortError(err)) return;

        if (attempt < RETRY_CONFIG.maxRetries) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelay,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // 所有重試都失敗
        const message =
          err instanceof Error ? err.message : "取得預約記錄時發生未知錯誤";
        setError(message);
        console.error("Error fetching booking records:", err);
      }
    }

    setIsLoading(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 自動載入預約記錄，並在卸載時清理
  useEffect(() => {
    fetchBookingRecords();
    return () => {
      abortControllerRef.current?.abort();
    };
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
