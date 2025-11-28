import { apiFetch } from "../utils/apiUtil";
import {
  GCS_UPLOAD_URL,
  GCS_DELETE_URL,
  GCS_SIGNED_URL,
} from "../constants/api";

// 10MB max audio file size
export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SIZE_MB = 10;

/**
 * 取得音訊檔案在 GCS 的路徑
 *
 * @param userId - 使用者 ID
 * @param recordId - 練習記錄 ID
 * @returns GCS 路徑
 */
function getAudioPath(userId: string, recordId: string): string {
  return `speech-practice/${userId}/${recordId}.webm`;
}

/**
 * 上傳練習錄音檔案到 GCS
 *
 * @param userId - 使用者 ID
 * @param recordId - 練習記錄 ID
 * @param audioBlob - 音訊 Blob (webm 格式)
 * @returns GCS 檔案路徑
 * @throws Error 如果檔案過大或上傳失敗
 */
export async function uploadPracticeAudio(
  userId: string,
  recordId: string,
  audioBlob: Blob,
): Promise<string> {
  // Validate file size
  if (audioBlob.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(
      `錄音檔案過大，最大允許 ${MAX_AUDIO_SIZE_MB}MB，目前大小 ${(
        audioBlob.size /
        1024 /
        1024
      ).toFixed(2)}MB`,
    );
  }

  const path = getAudioPath(userId, recordId);

  // Create FormData for multipart upload
  const formData = new FormData();
  formData.append("file", audioBlob, `${recordId}.webm`);
  formData.append("path", path);

  const response = await apiFetch(GCS_UPLOAD_URL, {
    method: "POST",
    includeAuthToken: true,
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "上傳錄音失敗");
  }

  // Return the file path (stored in Firestore)
  return path;
}

/**
 * 刪除練習錄音檔案
 *
 * @param userId - 使用者 ID
 * @param recordId - 練習記錄 ID
 */
export async function deletePracticeAudio(
  userId: string,
  recordId: string,
): Promise<void> {
  const path = getAudioPath(userId, recordId);

  try {
    const response = await apiFetch(
      `${GCS_DELETE_URL}?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
        includeAuthToken: true,
      },
    );

    if (!response.ok) {
      // Check if it's a 404 (file not found) - ignore this error
      if (response.status === 404) {
        console.warn(`Audio file not found: ${path}`);
        return;
      }
      const error = await response
        .json()
        .catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || "刪除錄音失敗");
    }
  } catch (error) {
    // Ignore "not found" errors - file may not exist
    if (error instanceof Error && error.message.includes("not found")) {
      console.warn(`Audio file not found: ${path}`);
      return;
    }
    throw error;
  }
}

/**
 * 取得音訊檔案的簽名 URL（用於播放）
 *
 * @param path - GCS 檔案路徑
 * @param expirationMinutes - URL 有效期限（分鐘），預設 60 分鐘
 * @returns 簽名 URL
 */
export async function getAudioSignedUrl(
  path: string,
  expirationMinutes: number = 60,
): Promise<string> {
  const params = new URLSearchParams({
    path,
    expiration_minutes: expirationMinutes.toString(),
  });

  const response = await apiFetch(`${GCS_SIGNED_URL}?${params}`, {
    method: "GET",
    includeAuthToken: true,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "取得音訊 URL 失敗");
  }

  const data = await response.json();
  return data.url;
}
