import { supabase, STORAGE_BUCKET } from "../utils/supabaseClient";

// 10MB max audio file size
export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SIZE_MB = 10;

/** 取得錄音檔在 storage 的路徑。 */
function getAudioPath(userId: string, recordId: string): string {
  return `speech-practice/${userId}/${recordId}.webm`;
}

/** 上傳練習錄音（webm）。回傳儲存路徑。 */
export async function uploadPracticeAudio(
  userId: string,
  recordId: string,
  audioBlob: Blob,
): Promise<string> {
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

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, audioBlob, { contentType: "audio/webm", upsert: true });

  if (error) {
    throw new Error(error.message || "上傳錄音失敗");
  }

  return path;
}

/** 刪除練習錄音（找不到不視為錯誤）。 */
export async function deletePracticeAudio(
  userId: string,
  recordId: string,
): Promise<void> {
  const path = getAudioPath(userId, recordId);

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);

  if (error) {
    if (error.message?.includes("not found")) {
      console.warn(`Audio file not found: ${path}`);
      return;
    }
    throw new Error(error.message || "刪除錄音失敗");
  }
}

/** 取得錄音播放用的短效簽名 URL（expirationMinutes 預設 60）。 */
export async function getAudioSignedUrl(
  path: string,
  expirationMinutes: number = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expirationMinutes * 60);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "取得音訊 URL 失敗");
  }

  return data.signedUrl;
}
