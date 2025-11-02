/**
 * OiKID 課程預約記錄
 */
export interface BookingRecord {
  /** 預約 ID */
  id: string;
  /** 課程級別 */
  Level: string;
  /** 課程版本 */
  ClassVersion: string;
  /** 課程名稱 */
  CoursesName: string;
  /** 上課時間 (格式: YYYY-MM-DD HH:mm:ss) */
  ClassTime: string;
  /** 教師名稱 */
  TeacherName: string;
  /** 開放課程名稱 */
  OpenName: string;
}

/**
 * OiKID 預約記錄 API 回應
 */
export interface BookingRecordsResponse {
  /** API Token */
  Token: string;
  /** 預約記錄列表 */
  Data: BookingRecord[];
}
